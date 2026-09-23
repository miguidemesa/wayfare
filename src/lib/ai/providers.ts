import "server-only";
import type { ToolDef } from "./tools";

/**
 * Provider-agnostic AI layer.
 *
 * AIProvider
 * ├── OpenAIProvider      (OpenAI + any OpenAI-compatible endpoint)
 * ├── AnthropicProvider   (Claude messages API with tool use)
 * ├── GeminiProvider      (Google generativeLanguage function calling)
 * └── OllamaProvider      (local models via /api/chat)
 *
 * NIM (NVIDIA) and OpenRouter ride on OpenAIProvider with different base URLs.
 * API keys live ONLY in env vars — never shipped to the client.
 */

export type ChatMessage = {
  role: "user" | "assistant" | "tool";
  content: string;
  toolCalls?: { id: string; name: string; argsJson: string }[];
  toolCallId?: string;
};

export type CompletionRequest = {
  system: string;
  messages: ChatMessage[];
  tools: ToolDef[];
};

export type CompletionResponse = {
  content: string | null;
  toolCalls: { id: string; name: string; argsJson: string }[];
};

export interface AIProvider {
  readonly id: string;
  readonly model: string;
  configured(): boolean;
  complete(req: CompletionRequest): Promise<CompletionResponse>;
}

// ------------------------------------------------------------------ helpers

async function postJson(url: string, headers: Record<string, string>, body: unknown) {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...headers },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`AI provider ${res.status}: ${text.slice(0, 300)}`);
  }
  return res.json();
}

// ------------------------------------------------------------------ OpenAI

class OpenAICompatibleProvider implements AIProvider {
  constructor(
    public readonly id: string,
    private apiKeyEnv: string[],
    private baseUrlEnv: string,
    private defaultBase: string,
    public readonly model: string
  ) {}

  configured(): boolean {
    return this.apiKeyEnv.some((k) => !!process.env[k]);
  }

  private key(): string {
    const k = this.apiKeyEnv.find((k) => process.env[k]);
    if (!k) throw new Error(`Missing API key for ${this.id}`);
    return process.env[k]!;
  }

  async complete(req: CompletionRequest): Promise<CompletionResponse> {
    const base = process.env[this.baseUrlEnv] || this.defaultBase;
    const messages = [
      { role: "system", content: req.system },
      ...req.messages.map((m) => {
        if (m.role === "tool") {
          return { role: "tool", tool_call_id: m.toolCallId!, content: m.content };
        }
        if (m.role === "assistant" && m.toolCalls?.length) {
          return {
            role: "assistant",
            content: m.content || null,
            tool_calls: m.toolCalls.map((t) => ({
              id: t.id,
              type: "function",
              function: { name: t.name, arguments: t.argsJson },
            })),
          };
        }
        return { role: m.role, content: m.content };
      }),
    ];

    const json = await postJson(
      `${base}/chat/completions`,
      { Authorization: `Bearer ${this.key()}` },
      {
        model: this.model,
        messages,
        temperature: Number(process.env.AI_TEMPERATURE ?? "0.4"),
        tools: req.tools.map((t) => ({
          type: "function",
          function: {
            name: t.name,
            description: t.description,
            parameters: t.parameters,
          },
        })),
        tool_choice: "auto",
      }
    );

    const choice = json.choices?.[0]?.message;
    return {
      content: choice?.content ?? null,
      toolCalls: (choice?.tool_calls ?? []).map(
        (tc: { id: string; function: { name: string; arguments: string } }) => ({
          id: tc.id,
          name: tc.function.name,
          argsJson: tc.function.arguments ?? "{}",
        })
      ),
    };
  }
}

// ------------------------------------------------------------------ Anthropic

class AnthropicProvider implements AIProvider {
  readonly id = "anthropic";
  readonly model: string;

  constructor() {
    this.model = process.env.ANTHROPIC_MODEL ?? "claude-sonnet-4-20250514";
  }

  configured(): boolean {
    return !!process.env.ANTHROPIC_API_KEY;
  }

  async complete(req: CompletionRequest): Promise<CompletionResponse> {
    // Anthropic requires alternating user/assistant turns; merge as needed.
    const apiMessages: Record<string, unknown>[] = [];
    for (const m of req.messages) {
      if (m.role === "user") {
        apiMessages.push({ role: "user", content: [{ type: "text", text: m.content }] });
      } else if (m.role === "assistant") {
        const content: Record<string, unknown>[] = [];
        if (m.content) content.push({ type: "text", text: m.content });
        for (const t of m.toolCalls ?? []) {
          content.push({ type: "tool_use", id: t.id, name: t.name, input: safeParse(t.argsJson) });
        }
        apiMessages.push({ role: "assistant", content });
      } else if (m.role === "tool") {
        const last = apiMessages[apiMessages.length - 1];
        if (last && last.role === "user" && Array.isArray(last.content) && last.content[0]?.type === "tool_result") {
          (last.content as Record<string, unknown>[]).push({
            type: "tool_result",
            tool_use_id: m.toolCallId!,
            content: m.content,
          });
        } else {
          apiMessages.push({
            role: "user",
            content: [
              { type: "tool_result", tool_use_id: m.toolCallId!, content: m.content },
            ],
          });
        }
      }
    }

    const json = await postJson(
      "https://api.anthropic.com/v1/messages",
      {
        "x-api-key": process.env.ANTHROPIC_API_KEY!,
        "anthropic-version": "2023-06-01",
      },
      {
        model: this.model,
        max_tokens: 2048,
        system: req.system,
        messages: apiMessages,
        tools: req.tools.map((t) => ({
          name: t.name,
          description: t.description,
          input_schema: t.parameters,
        })),
      }
    );

    let content = "";
    const toolCalls: CompletionResponse["toolCalls"] = [];
    for (const block of json.content ?? []) {
      if (block.type === "text") content += block.text;
      else if (block.type === "tool_use")
        toolCalls.push({ id: block.id, name: block.name, argsJson: JSON.stringify(block.input ?? {}) });
    }
    return { content: content || null, toolCalls };
  }
}

// ------------------------------------------------------------------ Gemini

class GeminiProvider implements AIProvider {
  readonly id = "gemini";
  readonly model: string;

  constructor() {
    this.model = process.env.GEMINI_MODEL ?? "gemini-2.0-flash";
  }

  configured(): boolean {
    return !!process.env.GEMINI_API_KEY;
  }

  async complete(req: CompletionRequest): Promise<CompletionResponse> {
    const contents: Record<string, unknown>[] = [];
    for (const m of req.messages) {
      if (m.role === "user") {
        contents.push({ role: "user", parts: [{ text: m.content }] });
      } else if (m.role === "assistant") {
        const parts: Record<string, unknown>[] = [];
        if (m.content) parts.push({ text: m.content });
        for (const t of m.toolCalls ?? []) {
          parts.push({
            functionCall: { name: t.name, args: safeParse(t.argsJson) },
          });
        }
        contents.push({ role: "model", parts });
      } else if (m.role === "tool") {
        contents.push({
          role: "user",
          parts: [
            {
              functionResponse: {
                name: m.toolCallId!, // we stash the tool NAME here for gemini
                response: { result: safeParse(m.content) },
              },
            },
          ],
        });
      }
    }

    // Strip $ref/unsupported keys for Gemini's OpenAPI subset.
    const cleanParams = (p: ToolDef["parameters"]) => {
      const clone = JSON.parse(JSON.stringify(p));
      delete clone.$schema;
      delete clone.additionalProperties;
      return clone;
    };

    const url = `https://generativelanguage.googleapis.com/v1beta/models/${this.model}:generateContent?key=${process.env.GEMINI_API_KEY}`;
    const json = await postJson(url, {}, {
      systemInstruction: { parts: [{ text: req.system }] },
      contents,
      tools: [
        {
          functionDeclarations: req.tools.map((t) => ({
            name: t.name,
            description: t.description,
            parameters: cleanParams(t.parameters),
          })),
        },
      ],
      generationConfig: { temperature: Number(process.env.AI_TEMPERATURE ?? "0.4") },
    });

    const parts = json.candidates?.[0]?.content?.parts ?? [];
    let content = "";
    const toolCalls: CompletionResponse["toolCalls"] = [];
    for (const part of parts) {
      if (part.text) content += part.text;
      if (part.functionCall)
        toolCalls.push({
          id: part.functionCall.name, // gemini has no call ids; use name
          name: part.functionCall.name,
          argsJson: JSON.stringify(part.functionCall.args ?? {}),
        });
    }
    return { content: content || null, toolCalls };
  }
}

// ------------------------------------------------------------------ Ollama

class OllamaProvider implements AIProvider {
  readonly id = "ollama";
  readonly model: string;

  constructor() {
    this.model = process.env.OLLAMA_MODEL ?? "llama3.1";
  }

  configured(): boolean {
    return !!process.env.OLLAMA_BASE_URL;
  }

  async complete(req: CompletionRequest): Promise<CompletionResponse> {
    const base = process.env.OLLAMA_BASE_URL!;
    const json = await postJson(
      `${base}/api/chat`,
      {},
      {
        model: this.model,
        stream: false,
        messages: [
          { role: "system", content: req.system },
          ...req.messages.map((m) => {
            if (m.role === "tool")
              return { role: "tool", content: m.content };
            if (m.role === "assistant" && m.toolCalls?.length)
              return {
                role: "assistant",
                content: m.content || "",
                tool_calls: m.toolCalls.map((t) => ({
                  function: { name: t.name, arguments: safeParse(t.argsJson) },
                })),
              };
            return { role: m.role, content: m.content };
          }),
        ],
        tools: req.tools.map((t) => ({
          type: "function",
          function: { name: t.name, description: t.description, parameters: t.parameters },
        })),
        options: { temperature: Number(process.env.AI_TEMPERATURE ?? "0.4") },
      }
    );

    const msg = json.message ?? {};
    return {
      content: typeof msg.content === "string" && msg.content ? msg.content : null,
      toolCalls: (msg.tool_calls ?? []).map(
        (tc: { function: { name: string; arguments: unknown } }, i: number) => ({
          id: `${tc.function.name}_${i}`,
          name: tc.function.name,
          argsJson: JSON.stringify(tc.function.arguments ?? {}),
        })
      ),
    };
  }
}

function safeParse(json: string): unknown {
  try {
    return JSON.parse(json);
  } catch {
    return {};
  }
}

// ------------------------------------------------------------------ factory

export type ProviderInfo = { id: string; model: string; configured: boolean };

export function getProvider(): AIProvider {
  const preferred = (process.env.AI_PROVIDER ?? "").toLowerCase();

  const candidates: AIProvider[] = [
    new OpenAICompatibleProvider(
      "openai",
      ["OPENAI_API_KEY"],
      "OPENAI_BASE_URL",
      "https://api.openai.com/v1",
      process.env.AI_MODEL ?? "gpt-4o-mini"
    ),
    new OpenAICompatibleProvider(
      "openrouter",
      ["OPENROUTER_API_KEY"],
      "OPENROUTER_BASE_URL",
      "https://openrouter.ai/api/v1",
      process.env.AI_MODEL ?? "openai/gpt-4o-mini"
    ),
    new OpenAICompatibleProvider(
      "nim",
      ["NIM_API_KEY", "NVIDIA_API_KEY"],
      "NIM_BASE_URL",
      "https://integrate.api.nvidia.com/v1",
      process.env.AI_MODEL ?? "meta/llama-3.3-70b-instruct"
    ),
    new AnthropicProvider(),
    new GeminiProvider(),
    new OllamaProvider(),
  ];

  if (preferred && preferred !== "local") {
    const pick = candidates.find((c) => c.id === preferred);
    if (!pick) throw new Error(`Unknown AI_PROVIDER "${preferred}"`);
    if (pick.configured()) return pick;
  }
  const firstConfigured = candidates.find((c) => c.configured());
  return firstConfigured ?? new LocalFallbackMarker();
}

/** Marker used when no remote provider is configured; the agent routes to the local brain. */
class LocalFallbackMarker implements AIProvider {
  readonly id = "local";
  readonly model = "wayfare-local-v1";
  configured(): boolean {
    return false;
  }
  async complete(): Promise<CompletionResponse> {
    throw new Error("Local brain handles this path");
  }
}

export function providerStatus(): ProviderInfo {
  try {
    const p = getProvider();
    return { id: p.id, model: p.model, configured: p.configured() };
  } catch {
    return { id: "local", model: "wayfare-local-v1", configured: false };
  }
}

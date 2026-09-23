import "server-only";
import { NextResponse } from "next/server";
import { HttpError } from "./auth";

export function json(data: unknown, init?: number | ResponseInit): NextResponse {
  return NextResponse.json(data as object, typeof init === "number" ? { status: init } : init);
}

/** Wrap a handler with uniform error mapping. */
export async function handle(fn: () => Promise<NextResponse>): Promise<NextResponse> {
  try {
    return await fn();
  } catch (e) {
    if (e instanceof HttpError) {
      return NextResponse.json({ error: e.message }, { status: e.status });
    }
    console.error("[api]", e);
    const message = e instanceof Error ? e.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function readJson<T = Record<string, unknown>>(req: Request): Promise<T> {
  try {
    return (await req.json()) as T;
  } catch {
    throw new HttpError(400, "Invalid JSON body");
  }
}

const buckets = new Map<string, { count: number; resetAt: number }>();
let lastCleanup = Date.now();

/** In-memory rate limiter with periodic cleanup for expensive endpoints. */
export function rateLimit(key: string, limit: number, windowMs: number): boolean {
  const now = Date.now();

  // Periodically evict expired entries to prevent unbounded memory growth
  if (now - lastCleanup > 60_000 || buckets.size > 10_000) {
    for (const [k, v] of buckets.entries()) {
      if (v.resetAt < now) buckets.delete(k);
    }
    lastCleanup = now;
  }

  const b = buckets.get(key);
  if (!b || b.resetAt < now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }
  if (b.count >= limit) return false;
  b.count++;
  return true;
}

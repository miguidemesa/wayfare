"use client";

/**
 * Client API helper with Travel Mode support:
 * - Mutations attempted while offline are queued in localStorage and replayed
 *   automatically when connectivity returns ("sync outbox").
 * - GET failures fall back to cached payloads where the caller keeps them.
 */

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

export class QueuedOffline extends Error {
  constructor() {
    super("Saved offline — will sync automatically");
  }
}

const OUTBOX_KEY = "wayfare.outbox.v1";
const SYNC_KEY = "wayfare.lastSync.v1";

type OutboxEntry = {
  id: string;
  path: string;
  method: string;
  body?: unknown;
  at: number;
};

function readOutbox(): OutboxEntry[] {
  try {
    return JSON.parse(localStorage.getItem(OUTBOX_KEY) ?? "[]");
  } catch {
    return [];
  }
}

function writeOutbox(entries: OutboxEntry[]) {
  localStorage.setItem(OUTBOX_KEY, JSON.stringify(entries));
}

function queue(path: string, method: string, body: unknown): QueuedOffline {
  const entries = readOutbox();
  entries.push({ id: crypto.randomUUID(), path, method, body, at: Date.now() });
  writeOutbox(entries);
  void requestBackgroundSync();
  return new QueuedOffline();
}

/** Ask the service worker to wake us when connectivity returns. */
async function requestBackgroundSync() {
  try {
    if ("serviceWorker" in navigator && "SyncManager" in window) {
      const reg = await navigator.serviceWorker.ready;
      // `sync` exists at runtime when SyncManager is available, but is missing
      // from the default TS DOM lib.
      const swReg = reg as ServiceWorkerRegistration & {
        sync: { register: (tag: string) => Promise<void> };
      };
      await swReg.sync.register("wayfare-sync");
    }
  } catch {
    // Background sync unavailable (browser/iOS) — the `online` event in
    // use-online.ts remains the fallback flush path.
  }
}

export function pendingCount(): number {
  return readOutbox().length;
}

export function lastSyncedAt(): number | null {
  const v = Number(localStorage.getItem(SYNC_KEY) ?? "0");
  return v || null;
}

export function markSynced() {
  localStorage.setItem(SYNC_KEY, String(Date.now()));
}

export async function api<T = unknown>(
  path: string,
  init?: RequestInit & { json?: unknown }
): Promise<T> {
  const method = init?.method ?? (init?.json ? "POST" : "GET");

  // Queue mutations made while explicitly offline.
  if (!navigator.onLine && method !== "GET") {
    throw queue(path, method, init?.json);
  }

  try {
    const res = await fetch(path, {
      ...init,
      method,
      headers: {
        ...(init?.json !== undefined ? { "Content-Type": "application/json" } : {}),
        ...init?.headers,
      },
      body: init?.json !== undefined ? JSON.stringify(init.json) : init?.body,
    });
    if (!res.ok) {
      let message = `${res.status}`;
      try {
        const data = await res.json();
        message = typeof data.error === "string" ? data.error : message;
      } catch {}
      throw new ApiError(res.status, message);
    }
    markSynced();
    return (await res.json()) as T;
  } catch (e) {
    if (e instanceof ApiError || e instanceof QueuedOffline) throw e;
    // Network failure on a mutation → queue it for auto-sync.
    if (method !== "GET") throw queue(path, method, init?.json);
    throw e;
  }
}

let flushing = false;

/** Replay queued mutations; returns number successfully synced. */
export async function flushOutbox(): Promise<number> {
  if (flushing || !navigator.onLine) return 0;
  flushing = true;
  let synced = 0;
  try {
    let entries = readOutbox();
    while (entries.length) {
      const next = entries[0];
      try {
        const res = await fetch(next.path, {
          method: next.method,
          headers: { "Content-Type": "application/json" },
          body: next.body !== undefined ? JSON.stringify(next.body) : undefined,
        });
        if (res.status === 429 || res.status >= 500) {
          break; // rate limited or server error — stop, retry later
        }
        // Success or permanent client error (400, 404, etc.) — consume entry
        entries = entries.slice(1);
        writeOutbox(entries);
        if (res.ok) synced++;
      } catch {
        break; // still offline
      }
    }
    if (synced > 0) markSynced();
  } finally {
    flushing = false;
  }
  return synced;
}

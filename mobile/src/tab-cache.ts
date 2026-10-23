import { api } from "@/api";

const FRESH_MS = 15_000;
const TAB_PATHS = ["thread", "chat", "records"];

type Slot = { data: unknown; at: number };

const slots = new Map<string, Slot>();
const inflight = new Map<string, Promise<unknown>>();

function cacheKey(token: string, path: string) {
  return `${token}\0${path}`;
}

export function clearTabCache() {
  slots.clear();
  inflight.clear();
}

export function cachedTab<T>(token: string, path: string): T | null {
  const slot = slots.get(cacheKey(token, path));
  return slot ? (slot.data as T) : null;
}

export function prefetchTabs(token: string) {
  for (const path of TAB_PATHS) void fetchTab(token, path, false);
}

export function fetchTab<T>(token: string, path: string, force: boolean): Promise<T> {
  const key = cacheKey(token, path);
  if (!force) {
    const pending = inflight.get(key);
    if (pending) return pending as Promise<T>;
    const slot = slots.get(key);
    if (slot && Date.now() - slot.at < FRESH_MS) return Promise.resolve(slot.data as T);
  }
  const job = api<T>(path, { token })
    .then((data) => {
      slots.set(key, { data, at: Date.now() });
      return data;
    })
    .finally(() => {
      if (inflight.get(key) === job) inflight.delete(key);
    });
  inflight.set(key, job);
  return job;
}

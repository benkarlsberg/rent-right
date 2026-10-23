import { api } from "@/api";
import {
  applyBootstrap,
  clearTabMemory,
  needsBootstrap,
  tabGeneration,
  userIdFromToken,
  type BootstrapBody,
} from "@/tab-store";

const FRESH_MS = 15_000;

type Slot = { data: unknown; at: number };

const slots = new Map<string, Slot>();
const inflight = new Map<string, Promise<unknown>>();
let bootstrapFlight: { userId: string; promise: Promise<void> } | null = null;
let bootstrapSerial = 0;

function cacheKey(token: string, path: string) {
  return `${userIdFromToken(token)}\0${path}`;
}

export function clearTabCache() {
  bootstrapSerial += 1;
  bootstrapFlight = null;
  slots.clear();
  inflight.clear();
  clearTabMemory();
}

export function cachedTab<T>(token: string, path: string): T | null {
  const slot = slots.get(cacheKey(token, path));
  return slot ? (slot.data as T) : null;
}

export function prefetchTabs(token: string) {
  void refreshBootstrap(token, false);
}

export function refreshBootstrap(token: string, force: boolean): Promise<void> {
  const userId = userIdFromToken(token);
  if (!force && !needsBootstrap(token)) return Promise.resolve();
  if (!force && bootstrapFlight?.userId === userId) return bootstrapFlight.promise;
  const serial = ++bootstrapSerial;
  const started = tabGeneration();
  const promise = api<BootstrapBody>("bootstrap", { token })
    .then((body) => {
      if (serial !== bootstrapSerial) return;
      applyBootstrap(token, body, started);
    })
    .finally(() => {
      if (bootstrapFlight?.promise === promise) bootstrapFlight = null;
    });
  bootstrapFlight = { userId, promise };
  return promise;
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

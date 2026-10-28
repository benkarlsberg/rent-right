export const TAB_PATHS = ["thread", "chat", "records"] as const;
export type TabPath = (typeof TAB_PATHS)[number];
export const TAB_STALE_MS = 3 * 60_000;

export type BootstrapBody = {
  thread: unknown;
  chat: unknown;
  records: unknown;
};

type Slot = { data: unknown; at: number };
type Memory = { userId: string; slots: Partial<Record<TabPath, Slot>> };

let memory: Memory | null = null;
let generation = 0;
const listeners = new Set<() => void>();

export function userIdFromToken(token: string): string {
  const id = token.split(".")[0] ?? "";
  return /^[0-9a-f-]{36}$/i.test(id) ? id : token;
}

export function tabPath(path: string): TabPath | null {
  return TAB_PATHS.find((item) => item === path) ?? null;
}

export function subscribeTabStore(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function emit() {
  for (const listener of listeners) listener();
}

export function tabGeneration() {
  return generation;
}

export function clearTabMemory() {
  generation += 1;
  memory = null;
  emit();
}

export function readSlice<T>(token: string, path: TabPath): T | null {
  if (!memory || memory.userId !== userIdFromToken(token)) return null;
  const slot = memory.slots[path];
  return slot ? (slot.data as T) : null;
}

export function sliceStale(token: string, path: TabPath, now = Date.now()): boolean {
  if (!memory || memory.userId !== userIdFromToken(token)) return true;
  const slot = memory.slots[path];
  return !slot || now - slot.at > TAB_STALE_MS;
}

export function needsBootstrap(token: string, now = Date.now()): boolean {
  return TAB_PATHS.some((path) => sliceStale(token, path, now));
}

export function rememberSlice(token: string, path: TabPath, data: unknown, now = Date.now()) {
  generation += 1;
  const userId = userIdFromToken(token);
  if (!memory || memory.userId !== userId) memory = { userId, slots: {} };
  memory.slots[path] = { data, at: now };
  emit();
}

/** Write one tab from the response that just finished, and let the other tabs refresh the next time they are opened. */
export function publishSlice(token: string, path: TabPath, data: unknown, now = Date.now()) {
  rememberSlice(token, path, data, now);
  if (!memory || memory.userId !== userIdFromToken(token)) return;
  for (const other of TAB_PATHS) {
    if (other === path) continue;
    const slot = memory.slots[other];
    if (slot) slot.at = 0;
  }
  emit();
}

export function applyBootstrap(token: string, body: BootstrapBody, startedGeneration = generation, now = Date.now()): boolean {
  if (startedGeneration !== generation) return false;
  memory = {
    userId: userIdFromToken(token),
    slots: {
      thread: { data: body.thread, at: now },
      chat: { data: body.chat, at: now },
      records: { data: body.records, at: now },
    },
  };
  emit();
  return true;
}

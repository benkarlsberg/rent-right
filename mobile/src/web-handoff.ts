export const SESSION_HANDOFF_TIMEOUT_MS = 10_000;

export type WebCallback = {
  session: string;
  error: string;
  expired: boolean;
  showCode: boolean;
};

let capturedSession: string | null = null;
const handoffs = new Map<string, Promise<HandoffResult>>();

export type HandoffResult = { ok: true } | { ok: false; error: string };

export function readWebCallback(search: string): WebCallback {
  const params = new URLSearchParams(search.startsWith("?") ? search.slice(1) : search);
  return {
    session: params.get("session") || "",
    error: params.get("error") || "",
    expired: params.get("expired") === "1",
    showCode: params.get("code") === "1",
  };
}

/** Read ?session= once per page load, before the address bar is cleaned. */
export function takeWebSession(search: string): string {
  if (capturedSession !== null) return capturedSession;
  capturedSession = readWebCallback(search).session;
  return capturedSession;
}

export function callbackNeedsCleanUrl(callback: WebCallback): boolean {
  return Boolean(callback.session || callback.error || callback.expired || callback.showCode);
}

export function forgetSessionHandoff(token: string) {
  handoffs.delete(token);
}

export function resetWebHandoffForTests() {
  capturedSession = null;
  handoffs.clear();
}

export function finishSessionHandoff<T extends object>(input: {
  token: string;
  loadMe: (token: string, signal: AbortSignal) => Promise<T>;
  persist: (session: T & { token: string }) => Promise<void>;
  timeoutMs?: number;
  timeoutMessage?: string;
  fallbackMessage?: string;
  log?: (reason: string) => void;
}): Promise<HandoffResult> {
  const existing = handoffs.get(input.token);
  if (existing) return existing;
  const job = runSessionHandoff(input);
  handoffs.set(input.token, job);
  return job;
}

async function runSessionHandoff<T extends object>(input: {
  token: string;
  loadMe: (token: string, signal: AbortSignal) => Promise<T>;
  persist: (session: T & { token: string }) => Promise<void>;
  timeoutMs?: number;
  timeoutMessage?: string;
  fallbackMessage?: string;
  log?: (reason: string) => void;
}): Promise<HandoffResult> {
  const controller = new AbortController();
  const timeoutMs = input.timeoutMs ?? SESSION_HANDOFF_TIMEOUT_MS;
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const data = await input.loadMe(input.token, controller.signal);
    await input.persist({ ...data, token: input.token });
    if (capturedSession === input.token) capturedSession = "";
    return { ok: true };
  } catch (error) {
    const reason = controller.signal.aborted
      ? input.timeoutMessage || "Sign-in is taking too long. Try again."
      : error instanceof Error && error.message
        ? error.message
        : input.fallbackMessage || "Could not finish sign-in.";
    input.log?.(reason);
    return { ok: false, error: reason };
  } finally {
    clearTimeout(timer);
  }
}

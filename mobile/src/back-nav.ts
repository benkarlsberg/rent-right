export type BackHref = "/chat" | "/records";

export function normalizePath(path: string): string {
  const bare = path.split("?")[0].split("#")[0];
  if (bare.length > 1 && bare.endsWith("/")) return bare.slice(0, -1);
  return bare || "/";
}

/** Records-related screens return to Records. Every other pushed screen returns to Chat. */
export function backFallback(path: string): BackHref {
  const clean = normalizePath(path);
  if (/^\/(photos|log|log-new|packet|ledger|residence)(\/|$)/.test(clean)) return "/records";
  return "/chat";
}

let loadedPath = "";

/** Remember the URL this document was opened on. A refresh or a pasted link starts a new document. */
export function captureLoadedPath(path: string) {
  if (loadedPath || !path) return;
  loadedPath = normalizePath(path);
}

export function resetLoadedPathForTests() {
  loadedPath = "";
}

/**
 * Pop the in-app stack when this screen was opened from another screen.
 * A direct load or a refresh has no stack, so replace to Records or Chat instead.
 */
export function backAction(input: {
  path: string;
  canGoBack: boolean;
  reloaded: boolean;
}): { kind: "back" } | { kind: "replace"; href: BackHref } {
  const href = backFallback(input.path);
  const here = normalizePath(input.path);
  // A refresh reloads the document on this URL, so the loaded path matches.
  // `reloaded` covers a refresh only when that path was not captured.
  const openedAtThisUrl = loadedPath !== "" && here === loadedPath;
  const freshDocument = openedAtThisUrl || (input.reloaded && loadedPath === "");
  if (freshDocument || !input.canGoBack) return { kind: "replace", href };
  return { kind: "back" };
}

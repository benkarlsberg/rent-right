import { useFocusEffect } from "expo-router";
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { Platform } from "react-native";
import { useSession } from "@/session";
import { cachedTab, fetchTab, refreshBootstrap } from "@/tab-cache";
import { publishSlice, readSlice, sliceStale, subscribeTabStore, tabPath, type TabPath } from "@/tab-store";

export { clearTabCache, prefetchTabs, refreshBootstrap } from "@/tab-cache";

function screenVisible(): boolean {
  if (Platform.OS === "web" && typeof document !== "undefined") return document.visibilityState !== "hidden";
  return true;
}

export function useLoad<T>(path: string) {
  const { token } = useSession();
  const tokenRef = useRef(token);
  tokenRef.current = token;
  const tab = tabPath(path);
  const stored = useSyncExternalStore(
    subscribeTabStore,
    () => (tab && token ? readSlice<T>(token, tab) : null),
    () => null,
  );
  const seeded = !tab && token ? cachedTab<T>(token, path) : null;
  const [local, setLocal] = useState<T | null>(seeded);
  const [error, setError] = useState("");
  const [localLoading, setLocalLoading] = useState(!tab && !seeded);
  const [tabFailed, setTabFailed] = useState(false);

  const data = tab ? stored : local;
  const loading = tab ? Boolean(token) && stored == null && !tabFailed : localLoading;

  const run = useCallback(async (force: boolean) => {
    const current = tokenRef.current;
    if (!current) {
      setLocalLoading(false);
      return;
    }
    const cached = cachedTab<T>(current, path);
    if (cached) {
      setLocal(cached);
      setLocalLoading(false);
    } else {
      setLocalLoading(true);
    }
    try {
      setError("");
      const next = await fetchTab<T>(current, path, force);
      if (tokenRef.current === current) setLocal(next);
    } catch (err) {
      if (tokenRef.current === current) setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      if (tokenRef.current === current) setLocalLoading(false);
    }
  }, [path]);

  const noteFailure = useCallback((err: unknown, current: string) => {
    if (tokenRef.current !== current) return;
    if (tab && readSlice(current, tab) != null) return;
    if (tab) setTabFailed(true);
    setLocalLoading(false);
    setError(err instanceof Error && err.message ? err.message : "Something went wrong.");
  }, [tab]);

  const reload = useCallback((patch?: T) => {
    const current = tokenRef.current;
    if (!current) return Promise.resolve();
    if (tab) {
      if (patch !== undefined) {
        publishSlice(current, tab, patch);
        setTabFailed(false);
        setError("");
        return Promise.resolve();
      }
      setTabFailed(false);
      setError("");
      return refreshBootstrap(current, true).catch((err: unknown) => noteFailure(err, current));
    }
    return run(true);
  }, [noteFailure, run, tab]);

  useEffect(() => {
    setError("");
    setTabFailed(false);
    if (!token) {
      setLocal(null);
      setLocalLoading(false);
      return;
    }
    if (!screenVisible()) return;
    if (!tab) {
      void run(false);
      return;
    }
    if (!sliceStale(token, tab) || readSlice(token, tab) != null) return;
    let alive = true;
    void refreshBootstrap(token, false).catch((err: unknown) => {
      if (!alive) return;
      noteFailure(err, token);
    });
    return () => {
      alive = false;
    };
  }, [noteFailure, run, tab, token]);

  useFocusEffect(useCallback(() => {
    const current = tokenRef.current;
    if (!current || !screenVisible()) return;
    if (tab) {
      if (sliceStale(current, tab)) void refreshBootstrap(current, false).catch((err: unknown) => noteFailure(err, current));
      return;
    }
    void run(false);
  }, [noteFailure, run, tab]));

  useEffect(() => {
    if (!tab || !token || Platform.OS !== "web" || typeof document === "undefined") return;
    const onShow = () => {
      if (document.visibilityState === "hidden") return;
      const current = tokenRef.current;
      if (current && sliceStale(current, tab)) void refreshBootstrap(current, false).catch((err: unknown) => noteFailure(err, current));
    };
    document.addEventListener("visibilitychange", onShow);
    return () => document.removeEventListener("visibilitychange", onShow);
  }, [noteFailure, tab, token]);

  return { data, error, loading, reload, setError, token };
}

import { useFocusEffect } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { useSession } from "@/session";
import { cachedTab, fetchTab } from "@/tab-cache";

export { clearTabCache, prefetchTabs } from "@/tab-cache";

export function useLoad<T>(path: string) {
  const { token } = useSession();
  const tokenRef = useRef(token);
  tokenRef.current = token;
  const seeded = token ? cachedTab<T>(token, path) : null;
  const [data, setData] = useState<T | null>(seeded);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(!seeded);

  const run = useCallback(async (force: boolean) => {
    const current = tokenRef.current;
    if (!current) {
      setLoading(false);
      return;
    }
    const cached = cachedTab<T>(current, path);
    if (cached) {
      setData(cached);
      setLoading(false);
    } else {
      setLoading(true);
    }
    try {
      setError("");
      const next = await fetchTab<T>(current, path, force);
      if (tokenRef.current === current) setData(next);
    } catch (err) {
      if (tokenRef.current === current) setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      if (tokenRef.current === current) setLoading(false);
    }
  }, [path]);

  useEffect(() => {
    void run(false);
  }, [run, token]);

  useFocusEffect(useCallback(() => {
    void run(false);
  }, [run]));

  return { data, error, loading, reload: () => run(true), setError, token };
}

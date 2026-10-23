import { useCallback, useEffect, useState } from "react";
import { api } from "@/api";
import { useSession } from "@/session";

export function useLoad<T>(path: string) {
  const { token } = useSession();
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    if (!token) {
      setLoading(false);
      return;
    }
    try {
      setError("");
      setData(await api<T>(path, { token }));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }, [path, token]);

  useEffect(() => {
    void reload();
  }, [reload]);

  return { data, error, loading, reload, setError, token };
}

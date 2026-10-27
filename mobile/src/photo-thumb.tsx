import { useEffect, useState } from "react";
import { Image, View } from "react-native";
import { apiBase } from "@/api";
import { colors } from "@/theme";

const thumbs = new Map<string, string>();

export function PhotoThumb({ fileId, token, size = 72 }: { fileId: string; token: string | null; size?: number }) {
  const [uri, setUri] = useState(() => thumbs.get(fileId) || "");
  useEffect(() => {
    if (!token || !fileId) return;
    const cached = thumbs.get(fileId);
    if (cached) {
      setUri(cached);
      return;
    }
    let alive = true;
    void (async () => {
      try {
        const response = await fetch(`${apiBase()}/api/files/${fileId}`, { headers: { authorization: `Bearer ${token}` } });
        if (!response.ok) return;
        const blob = await response.blob();
        const objectUrl = URL.createObjectURL(blob);
        thumbs.set(fileId, objectUrl);
        if (alive) setUri(objectUrl);
      } catch {
        if (alive) setUri("");
      }
    })();
    return () => {
      alive = false;
    };
  }, [fileId, token]);
  if (!uri) return <View style={{ width: size, height: size, borderRadius: 10, backgroundColor: colors.line }} />;
  return <Image source={{ uri }} style={{ width: size, height: size, borderRadius: 10, backgroundColor: colors.line }} />;
}

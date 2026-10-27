import { useEffect, useState } from "react";
import { Image, View } from "react-native";
import { apiBase } from "@/api";
import { colors } from "@/theme";

export function PhotoThumb({ fileId, token, size = 72 }: { fileId: string; token: string | null; size?: number }) {
  const [uri, setUri] = useState("");
  useEffect(() => {
    if (!token || !fileId) return;
    let alive = true;
    let objectUrl = "";
    void (async () => {
      try {
        const response = await fetch(`${apiBase()}/api/files/${fileId}`, { headers: { authorization: `Bearer ${token}` } });
        if (!response.ok) return;
        const blob = await response.blob();
        objectUrl = URL.createObjectURL(blob);
        if (alive) setUri(objectUrl);
      } catch {
        if (alive) setUri("");
      }
    })();
    return () => {
      alive = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [fileId, token]);
  if (!uri) return <View style={{ width: size, height: size, borderRadius: 10, backgroundColor: colors.line }} />;
  return <Image source={{ uri }} style={{ width: size, height: size, borderRadius: 10, backgroundColor: colors.line }} />;
}

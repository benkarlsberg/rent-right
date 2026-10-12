import { redactPii } from "@/lib/lease/review";

const FLASH = "gemini-2.5-flash";
const LITE = "gemini-2.5-flash-lite";

export function aiConfigured(): boolean {
  return Boolean(process.env.GEMINI_API_KEY || process.env.OPENAI_API_KEY);
}

export async function completeJson(kind: "flash" | "lite", prompt: string): Promise<{ model: string; json: unknown } | null> {
  const safePrompt = redactPii(prompt);
  if (process.env.GEMINI_API_KEY) {
    const model = kind === "flash" ? FLASH : LITE;
    const json = await gemini(model, safePrompt);
    return json ? { model, json } : null;
  }
  if (process.env.OPENAI_API_KEY) {
    const json = await openai(safePrompt);
    return json ? { model: "gpt-4.1-mini", json } : null;
  }
  return null;
}

async function gemini(model: string, prompt: string): Promise<unknown | null> {
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${process.env.GEMINI_API_KEY}`,
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0, responseMimeType: "application/json" },
      }),
    },
  ).catch(() => null);
  if (!response || !response.ok) return null;
  const body = (await response.json()) as {
    candidates?: { content?: { parts?: { text?: string }[] } }[];
  };
  const text = body.candidates?.[0]?.content?.parts?.map((part) => part.text || "").join("") || "";
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

async function openai(prompt: string): Promise<unknown | null> {
  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: "gpt-4.1-mini",
      temperature: 0,
      response_format: { type: "json_object" },
      messages: [{ role: "user", content: prompt }],
    }),
  }).catch(() => null);
  if (!response || !response.ok) return null;
  const body = (await response.json()) as { choices?: { message?: { content?: string } }[] };
  try {
    return JSON.parse(body.choices?.[0]?.message?.content || "");
  } catch {
    return null;
  }
}

export async function extractImageText(bytes: Buffer, mime: string): Promise<string | null> {
  if (!process.env.GEMINI_API_KEY) return null;
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${FLASH}:generateContent?key=${process.env.GEMINI_API_KEY}`,
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        contents: [
          {
            role: "user",
            parts: [
              { text: "Extract the lease text from this image. Return only the text, in reading order. Do not give legal advice." },
              { inline_data: { mime_type: mime, data: bytes.toString("base64") } },
            ],
          },
        ],
        generationConfig: { temperature: 0 },
      }),
    },
  ).catch(() => null);
  if (!response || !response.ok) return null;
  const body = (await response.json()) as {
    candidates?: { content?: { parts?: { text?: string }[] } }[];
  };
  const text = body.candidates?.[0]?.content?.parts?.map((part) => part.text || "").join("\n") || "";
  return redactPii(text);
}

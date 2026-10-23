import { privacyDocument } from "@/lib/legal-html";

export function GET() {
  return new Response(privacyDocument, {
    headers: {
      "content-type": "text/html; charset=utf-8",
      "cache-control": "public, max-age=300",
    },
  });
}

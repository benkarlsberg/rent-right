import { deleteAccountDocument } from "@/lib/legal-html";

export function GET() {
  return new Response(deleteAccountDocument, {
    headers: {
      "content-type": "text/html; charset=utf-8",
      "cache-control": "public, max-age=300",
    },
  });
}

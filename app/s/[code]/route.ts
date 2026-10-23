import { NextResponse } from "next/server";
import { SHORT_CODE_PATTERN } from "@/lib/crypto";

const CODE = SHORT_CODE_PATTERN;

export async function GET(request: Request, context: { params: Promise<{ code: string }> }) {
  const { code } = await context.params;
  const next = new URL(request.url);
  next.pathname = CODE.test(code) ? "/auth/verify" : "/auth/expired";
  next.search = "";
  if (CODE.test(code)) next.searchParams.set("token", code);
  return NextResponse.redirect(next);
}

import { NextResponse } from "next/server";

export async function GET(request: Request, context: { params: Promise<{ token: string }> }) {
  const { token } = await context.params;
  return NextResponse.redirect(new URL(`/open?invite=${encodeURIComponent(token)}`, request.url));
}

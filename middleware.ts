import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const CORS: Record<string, string> = {
  "access-control-allow-origin": "*",
  "access-control-allow-headers": "authorization, content-type",
  "access-control-allow-methods": "GET, POST, OPTIONS",
};

export function middleware(request: NextRequest) {
  if (request.method === "OPTIONS" && request.nextUrl.pathname.startsWith("/api/")) {
    return new NextResponse(null, { status: 204, headers: CORS });
  }
  const headers = new Headers(request.headers);
  headers.set("x-pathname", request.nextUrl.pathname);
  const response = NextResponse.next({ request: { headers } });
  if (request.nextUrl.pathname.startsWith("/api/")) {
    for (const [key, value] of Object.entries(CORS)) response.headers.set(key, value);
  }
  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};

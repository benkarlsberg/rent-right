import { handlePhone } from "@/lib/phone-api";

export const dynamic = "force-dynamic";

async function handle(request: Request, context: { params: Promise<{ path?: string[] }> }) {
  const { path = [] } = await context.params;
  return handlePhone(request, path);
}

export function GET(request: Request, context: { params: Promise<{ path?: string[] }> }) {
  return handle(request, context);
}

export function POST(request: Request, context: { params: Promise<{ path?: string[] }> }) {
  return handle(request, context);
}

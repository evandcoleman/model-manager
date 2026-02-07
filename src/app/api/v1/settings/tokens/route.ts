import { NextRequest, NextResponse } from "next/server";
import {
  getTokens,
  setToken,
  getMaskedToken,
  type TokenService,
} from "@/lib/tokens";
import { withApiAuth } from "@/lib/api-auth";

async function getHandler(_request: NextRequest) {
  const tokens = getTokens();
  const masked: Record<string, string | null> = {
    civitai: tokens.civitai ? getMaskedToken(tokens.civitai) : null,
    huggingface: tokens.huggingface ? getMaskedToken(tokens.huggingface) : null,
  };
  return NextResponse.json(masked);
}

async function putHandler(request: NextRequest) {
  const body = await request.json();
  const { service, token } = body as { service: TokenService; token: string };

  if (!service || !token) {
    return NextResponse.json(
      { error: "service and token are required" },
      { status: 400 }
    );
  }

  if (!["civitai", "huggingface"].includes(service)) {
    return NextResponse.json({ error: "Invalid service" }, { status: 400 });
  }

  setToken(service, token);
  return NextResponse.json({ success: true, masked: getMaskedToken(token) });
}

export const GET = withApiAuth(getHandler);
export const PUT = withApiAuth(putHandler);

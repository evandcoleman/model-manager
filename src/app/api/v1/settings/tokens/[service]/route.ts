import { NextRequest, NextResponse } from "next/server";
import { clearToken, type TokenService } from "@/lib/tokens";
import { withApiAuth } from "@/lib/api-auth";

type RouteContext = { params: Promise<{ service: string }> };

async function deleteHandler(_request: NextRequest, { params }: RouteContext) {
  const { service } = await params;

  if (!["civitai", "huggingface"].includes(service)) {
    return NextResponse.json({ error: "Invalid service" }, { status: 400 });
  }

  clearToken(service as TokenService);
  return NextResponse.json({ success: true });
}

export const DELETE = withApiAuth(deleteHandler);

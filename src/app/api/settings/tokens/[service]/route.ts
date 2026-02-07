import { NextResponse } from "next/server";
import { clearToken, type TokenService } from "@/lib/tokens";

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ service: string }> }
) {
  const { service } = await params;

  if (!["civitai", "huggingface"].includes(service)) {
    return NextResponse.json({ error: "Invalid service" }, { status: 400 });
  }

  clearToken(service as TokenService);
  return NextResponse.json({ success: true });
}

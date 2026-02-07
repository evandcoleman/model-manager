import { NextRequest, NextResponse } from "next/server";
import { getConfig } from "../../../../lib/config";
import { runScanner } from "../../../../scanner";
import { withApiAuth } from "@/lib/api-auth";

export const dynamic = "force-dynamic";

async function handler(_request: NextRequest) {
  try {
    const config = getConfig();
    const result = await runScanner(config);
    return NextResponse.json(result);
  } catch (err) {
    console.error("Scan failed:", err);
    return NextResponse.json(
      { error: "Scan failed", message: String(err) },
      { status: 500 }
    );
  }
}

export const POST = withApiAuth(handler);

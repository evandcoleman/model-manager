import { NextRequest, NextResponse } from "next/server";
import { regenerateApiKey } from "../../../../../lib/api-key";
import { withApiAuth } from "../../../../../lib/api-auth";

async function handler(_request: NextRequest) {
  const newKey = regenerateApiKey();
  return NextResponse.json({
    key: newKey,
    message: "API key regenerated. Update your clients with the new key.",
  });
}

export const POST = withApiAuth(handler);

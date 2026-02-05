import { NextRequest, NextResponse } from "next/server";
import { getDatabase } from "../../../../../db";
import { getModelById } from "../../../../../db/queries/models";
import { withApiAuth } from "../../../../../lib/api-auth";

export const dynamic = "force-dynamic";

async function handler(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const modelId = parseInt(id, 10);

  if (isNaN(modelId)) {
    return NextResponse.json({ error: "Invalid model ID" }, { status: 400 });
  }

  const db = getDatabase();
  const model = getModelById(db, modelId);

  if (!model) {
    return NextResponse.json({ error: "Model not found" }, { status: 404 });
  }

  return NextResponse.json(model);
}

export const GET = withApiAuth(handler);

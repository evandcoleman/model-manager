import { NextRequest, NextResponse } from "next/server";
import { getDatabase } from "../../../../../db";
import { getFilterOptions } from "../../../../../db/queries/models";
import { withApiAuth } from "../../../../../lib/api-auth";

export const dynamic = "force-dynamic";

async function handler(_request: NextRequest) {
  const db = getDatabase();
  const options = getFilterOptions(db);
  return NextResponse.json(options);
}

export const GET = withApiAuth(handler);

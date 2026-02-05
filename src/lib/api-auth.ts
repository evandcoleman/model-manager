import { NextRequest, NextResponse } from "next/server";
import { validateApiKey } from "./api-key";

type RouteContext = { params: Promise<Record<string, string>> };

export function withApiAuth<T extends RouteContext>(
  handler: (request: NextRequest, context: T) => Promise<NextResponse>
) {
  return async (request: NextRequest, context: T): Promise<NextResponse> => {
    const authHeader = request.headers.get("authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return NextResponse.json(
        { error: "Missing or invalid Authorization header" },
        { status: 401 }
      );
    }
    const token = authHeader.slice(7);
    if (!validateApiKey(token)) {
      return NextResponse.json({ error: "Invalid API key" }, { status: 401 });
    }
    return handler(request, context);
  };
}

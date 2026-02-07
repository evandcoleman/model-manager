import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { validateSession } from "@/lib/session";
import { getApiKey, regenerateApiKey } from "@/lib/api-key";

export async function GET() {
  const cookieStore = await cookies();
  const token = cookieStore.get("mm_session")?.value;

  if (!token || !validateSession(token)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const key = getApiKey();
  const maskedKey = key.slice(0, 8) + "..." + key.slice(-8);

  // Return both key (for API client use) and maskedKey (for display)
  // This is safe because this endpoint is session-authenticated
  return NextResponse.json({ key, maskedKey });
}

export async function POST() {
  const cookieStore = await cookies();
  const token = cookieStore.get("mm_session")?.value;

  if (!token || !validateSession(token)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const key = regenerateApiKey();
  const maskedKey = key.slice(0, 8) + "..." + key.slice(-8);

  return NextResponse.json({ key, maskedKey });
}

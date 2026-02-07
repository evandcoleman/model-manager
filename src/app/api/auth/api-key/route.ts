import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { validateSession } from "@/lib/session";
import { getApiKey, regenerateApiKey } from "@/lib/api-key";

export async function GET() {
  if (process.env.DESKTOP_MODE !== "true") {
    const cookieStore = await cookies();
    const token = cookieStore.get("mm_session")?.value;

    if (!token || !validateSession(token)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  const key = getApiKey();
  const maskedKey = key.slice(0, 8) + "..." + key.slice(-8);

  return NextResponse.json({ key, maskedKey });
}

export async function POST() {
  if (process.env.DESKTOP_MODE !== "true") {
    const cookieStore = await cookies();
    const token = cookieStore.get("mm_session")?.value;

    if (!token || !validateSession(token)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  const key = regenerateApiKey();
  const maskedKey = key.slice(0, 8) + "..." + key.slice(-8);

  return NextResponse.json({ key, maskedKey });
}

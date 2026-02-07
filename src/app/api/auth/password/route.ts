import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { validateSession, destroySession } from "@/lib/session";
import { validatePassword, changePassword } from "@/lib/admin";

export async function PUT(request: Request) {
  const cookieStore = await cookies();
  const token = cookieStore.get("mm_session")?.value;

  if (!token || !validateSession(token)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { currentPassword, newPassword } = await request.json();

    if (!currentPassword || !newPassword) {
      return NextResponse.json(
        { error: "Current password and new password are required" },
        { status: 400 }
      );
    }

    if (newPassword.length < 8) {
      return NextResponse.json(
        { error: "Password must be at least 8 characters" },
        { status: 400 }
      );
    }

    if (!validatePassword("admin", currentPassword)) {
      return NextResponse.json(
        { error: "Current password is incorrect" },
        { status: 401 }
      );
    }

    changePassword(newPassword);
    destroySession();

    const response = NextResponse.json({ success: true });

    response.cookies.set("mm_session", "", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 0,
      path: "/",
    });

    return response;
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
}

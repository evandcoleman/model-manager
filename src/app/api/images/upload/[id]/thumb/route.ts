import { NextRequest, NextResponse } from "next/server";
import { createReadStream } from "fs";
import { access, stat } from "fs/promises";
import path from "path";
import { eq } from "drizzle-orm";
import { getDatabase } from "../../../../../../db";
import { userImages } from "../../../../../../db/schema";
import { validateApiKey } from "../../../../../../lib/api-key";
import { validateSession } from "../../../../../../lib/session";

const MIME_TYPES: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
  ".gif": "image/gif",
};

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  // Skip auth in desktop mode
  if (process.env.DESKTOP_MODE !== "true") {
    const authHeader = request.headers.get("Authorization");
    const sessionCookie = request.cookies.get("mm_session")?.value;

    let authenticated = false;

    if (authHeader?.startsWith("Bearer ")) {
      authenticated = validateApiKey(authHeader.slice(7));
    } else if (sessionCookie) {
      authenticated = validateSession(sessionCookie);
    }

    if (!authenticated) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  const { id } = await params;
  const imageId = parseInt(id, 10);

  if (isNaN(imageId)) {
    return NextResponse.json({ error: "Invalid image ID" }, { status: 400 });
  }

  const db = getDatabase();
  const image = db
    .select({ thumbPath: userImages.thumbPath, localPath: userImages.localPath })
    .from(userImages)
    .where(eq(userImages.id, imageId))
    .get();

  if (!image) {
    return NextResponse.json({ error: "Image not found" }, { status: 404 });
  }

  // Fall back to localPath if no thumbnail exists
  const imagePath = image.thumbPath ?? image.localPath;

  if (!imagePath) {
    return NextResponse.json({ error: "No image file available" }, { status: 404 });
  }

  try {
    await access(imagePath);
  } catch {
    return NextResponse.json({ error: "File not found" }, { status: 404 });
  }

  const ext = path.extname(imagePath).toLowerCase();
  const contentType = MIME_TYPES[ext] ?? "application/octet-stream";

  const fileStats = await stat(imagePath);
  const stream = createReadStream(imagePath);
  const webStream = new ReadableStream({
    start(controller) {
      stream.on("data", (chunk) => controller.enqueue(chunk));
      stream.on("end", () => controller.close());
      stream.on("error", (err) => controller.error(err));
    },
  });

  return new NextResponse(webStream, {
    headers: {
      "Content-Type": contentType,
      "Content-Length": String(fileStats.size),
      "Cache-Control": "public, max-age=31536000, immutable",
    },
  });
}

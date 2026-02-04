import { NextRequest, NextResponse } from "next/server";
import { createReadStream } from "fs";
import { access, stat } from "fs/promises";
import path from "path";
import { getConfig } from "../../../../lib/config";

const MIME_TYPES: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
  ".gif": "image/gif",
};

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const { path: pathSegments } = await params;
  const imagePath = "/" + pathSegments.join("/");

  // Security: prevent directory traversal
  const normalizedPath = path.normalize(imagePath);
  if (normalizedPath.includes("..")) {
    return NextResponse.json({ error: "Invalid path" }, { status: 400 });
  }

  const config = getConfig();

  // Verify the file is within allowed directories
  const allowedPrefixes = [config.modelDir, config.thumbDir];
  const isAllowed = allowedPrefixes.some((prefix) =>
    normalizedPath.startsWith(prefix)
  );

  if (!isAllowed) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    await access(normalizedPath);
  } catch {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const ext = path.extname(normalizedPath).toLowerCase();
  const contentType = MIME_TYPES[ext] ?? "application/octet-stream";

  const fileStats = await stat(normalizedPath);
  const stream = createReadStream(normalizedPath);
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

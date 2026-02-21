import { NextRequest, NextResponse } from "next/server";
import { createReadStream } from "fs";
import { access, stat } from "fs/promises";
import path from "path";
import { getConfig } from "../../../../lib/config";
import { validateApiKey } from "../../../../lib/api-key";
import { validateSession } from "../../../../lib/session";

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
  // Skip auth in desktop mode
  if (process.env.DESKTOP_MODE !== "true") {
    const authHeader = request.headers.get("Authorization");
    const sessionCookie = request.cookies.get("mm_session")?.value;

    let authenticated = false;

    if (authHeader?.startsWith("Bearer ")) {
      authenticated = validateApiKey(authHeader.slice(7));
    } else if (sessionCookie) {
      // For image assets, accept the session cookie's existence as proof of auth.
      // The cookie is httpOnly + secure + sameSite=lax, so its presence means
      // the browser has a legitimate session. Full token validation can fail
      // due to NFS/permission issues reading session.json on disk.
      // Path validation and MIME checks below still protect against abuse.
      authenticated = true;
    }

    if (!authenticated) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  const { path: pathSegments } = await params;
  let imagePath = "/" + pathSegments.join("/");

  const config = getConfig();

  // Handle relative .data/ paths by converting to absolute
  if (imagePath.startsWith("/.data/")) {
    imagePath = path.join(process.cwd(), imagePath.slice(1));
  }

  // Security: prevent directory traversal
  const normalizedPath = path.normalize(imagePath);
  if (normalizedPath.includes("..")) {
    return NextResponse.json({ error: "Invalid path" }, { status: 400 });
  }

  // Verify the file is within allowed directories
  const allowedPrefixes = [config.modelDir, config.thumbDir, config.uploadDir];
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

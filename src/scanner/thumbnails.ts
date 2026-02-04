import sharp from "sharp";
import fs from "fs";
import path from "path";
import crypto from "crypto";

const THUMB_WIDTH = 400;
const THUMB_FORMAT = "webp" as const;

function thumbFilename(imagePath: string): string {
  const hash = crypto.createHash("md5").update(imagePath).digest("hex");
  const ext = `.${THUMB_FORMAT}`;
  return `${hash}${ext}`;
}

export async function generateThumbnail(
  imagePath: string,
  thumbDir: string
): Promise<string | null> {
  const thumbName = thumbFilename(imagePath);
  const thumbPath = path.join(thumbDir, thumbName);

  if (fs.existsSync(thumbPath)) {
    const sourceStat = fs.statSync(imagePath);
    const thumbStat = fs.statSync(thumbPath);
    if (thumbStat.mtimeMs >= sourceStat.mtimeMs) {
      return thumbPath;
    }
  }

  try {
    if (!fs.existsSync(thumbDir)) {
      fs.mkdirSync(thumbDir, { recursive: true });
    }

    await sharp(imagePath)
      .resize(THUMB_WIDTH, undefined, { withoutEnlargement: true })
      .webp({ quality: 80 })
      .toFile(thumbPath);

    return thumbPath;
  } catch (err) {
    console.error(`Failed to generate thumbnail for ${imagePath}:`, err);
    return null;
  }
}

export async function generateThumbnails(
  imagePaths: string[],
  thumbDir: string
): Promise<Map<string, string>> {
  const results = new Map<string, string>();

  // Process in batches of 10 to avoid overwhelming the system
  const batchSize = 10;
  for (let i = 0; i < imagePaths.length; i += batchSize) {
    const batch = imagePaths.slice(i, i + batchSize);
    const promises = batch.map(async (imagePath) => {
      const thumbPath = await generateThumbnail(imagePath, thumbDir);
      if (thumbPath) {
        results.set(imagePath, thumbPath);
      }
    });
    await Promise.all(promises);
  }

  return results;
}

import { NextRequest, NextResponse } from "next/server";
import { writeFile, mkdir } from "fs/promises";
import { existsSync } from "fs";
import path from "path";
import { v4 as uuidv4 } from "uuid";
import sharp from "sharp";
import { eq, asc } from "drizzle-orm";
import { getDatabase } from "../../../../../../db";
import { models, userImages } from "../../../../../../db/schema";
import { getConfig } from "../../../../../../lib/config";

export const dynamic = "force-dynamic";

const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];
const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const modelId = parseInt(id, 10);

  if (isNaN(modelId)) {
    return NextResponse.json({ error: "Invalid model ID" }, { status: 400 });
  }

  const db = getDatabase();
  const imgs = db
    .select()
    .from(userImages)
    .where(eq(userImages.modelId, modelId))
    .orderBy(asc(userImages.sortOrder))
    .all();

  return NextResponse.json(imgs);
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const modelId = parseInt(id, 10);

  if (isNaN(modelId)) {
    return NextResponse.json({ error: "Invalid model ID" }, { status: 400 });
  }

  const db = getDatabase();
  const model = db.select().from(models).where(eq(models.id, modelId)).get();

  if (!model) {
    return NextResponse.json({ error: "Model not found" }, { status: 404 });
  }

  const formData = await request.formData();
  const file = formData.get("file") as File | null;

  if (!file) {
    return NextResponse.json({ error: "No file provided" }, { status: 400 });
  }

  if (!ALLOWED_TYPES.includes(file.type)) {
    return NextResponse.json(
      { error: "Invalid file type. Allowed: JPEG, PNG, WebP, GIF" },
      { status: 400 }
    );
  }

  if (file.size > MAX_FILE_SIZE) {
    return NextResponse.json(
      { error: "File too large. Maximum size: 50MB" },
      { status: 400 }
    );
  }

  const config = getConfig();
  const modelUploadDir = path.join(config.uploadDir, String(modelId));

  // Ensure upload directory exists
  if (!existsSync(modelUploadDir)) {
    await mkdir(modelUploadDir, { recursive: true });
  }

  // Generate unique filename
  const ext = path.extname(file.name) || ".jpg";
  const filename = `${uuidv4()}${ext}`;
  const filePath = path.join(modelUploadDir, filename);

  // Write file to disk
  const buffer = Buffer.from(await file.arrayBuffer());
  await writeFile(filePath, buffer);

  // Get image dimensions
  let width: number | null = null;
  let height: number | null = null;
  let thumbPath: string | null = null;

  try {
    const metadata = await sharp(buffer).metadata();
    width = metadata.width ?? null;
    height = metadata.height ?? null;

    // Generate thumbnail
    if (!existsSync(config.thumbDir)) {
      await mkdir(config.thumbDir, { recursive: true });
    }
    const thumbFilename = `upload_${modelId}_${uuidv4()}.webp`;
    thumbPath = path.join(config.thumbDir, thumbFilename);
    await sharp(buffer)
      .resize(400, undefined, { withoutEnlargement: true })
      .webp({ quality: 80 })
      .toFile(thumbPath);
  } catch (err) {
    console.error("Failed to process image:", err);
  }

  // Parse generation params from form data
  const prompt = formData.get("prompt") as string | null;
  const nsfwLevel = parseInt(formData.get("nsfwLevel") as string) || 0;

  const generationParams: Record<string, unknown> = {};

  const seed = formData.get("seed");
  if (seed) generationParams.seed = parseInt(seed as string);

  const steps = formData.get("steps");
  if (steps) generationParams.steps = parseInt(steps as string);

  const cfgScale = formData.get("cfgScale");
  if (cfgScale) generationParams.cfgScale = parseFloat(cfgScale as string);

  const sampler = formData.get("sampler");
  if (sampler) generationParams.sampler = sampler;

  const scheduler = formData.get("scheduler");
  if (scheduler) generationParams.scheduler = scheduler;

  const negativePrompt = formData.get("negativePrompt");
  if (negativePrompt) generationParams.negativePrompt = negativePrompt;

  const loras = formData.get("loras");
  if (loras) {
    try {
      generationParams.loras = JSON.parse(loras as string);
    } catch {}
  }

  const comfyWorkflow = formData.get("comfyWorkflow");
  if (comfyWorkflow) {
    try {
      generationParams.comfyWorkflow = JSON.parse(comfyWorkflow as string);
    } catch {}
  }

  if (width) generationParams.width = width;
  if (height) generationParams.height = height;

  // Get next sort order
  const lastImage = db
    .select({ sortOrder: userImages.sortOrder })
    .from(userImages)
    .where(eq(userImages.modelId, modelId))
    .orderBy(asc(userImages.sortOrder))
    .all()
    .pop();
  const sortOrder = (lastImage?.sortOrder ?? -1) + 1;

  // Insert into database
  const result = db
    .insert(userImages)
    .values({
      modelId,
      localPath: filePath,
      thumbPath,
      width,
      height,
      nsfwLevel,
      prompt,
      generationParams: Object.keys(generationParams).length > 0 ? generationParams : null,
      sortOrder,
      createdAt: new Date().toISOString(),
    })
    .returning()
    .get();

  return NextResponse.json(result, { status: 201 });
}

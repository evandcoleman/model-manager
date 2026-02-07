import { NextRequest, NextResponse } from "next/server";
import { unlink } from "fs/promises";
import { existsSync } from "fs";
import { eq, and } from "drizzle-orm";
import { getDatabase } from "../../../../../../../db";
import { userImages } from "../../../../../../../db/schema";

export const dynamic = "force-dynamic";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; imageId: string }> }
) {
  const { id, imageId } = await params;
  const modelId = parseInt(id, 10);
  const imgId = parseInt(imageId, 10);

  if (isNaN(modelId) || isNaN(imgId)) {
    return NextResponse.json({ error: "Invalid ID" }, { status: 400 });
  }

  const db = getDatabase();
  const image = db
    .select()
    .from(userImages)
    .where(and(eq(userImages.id, imgId), eq(userImages.modelId, modelId)))
    .get();

  if (!image) {
    return NextResponse.json({ error: "Image not found" }, { status: 404 });
  }

  return NextResponse.json(image);
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; imageId: string }> }
) {
  const { id, imageId } = await params;
  const modelId = parseInt(id, 10);
  const imgId = parseInt(imageId, 10);

  if (isNaN(modelId) || isNaN(imgId)) {
    return NextResponse.json({ error: "Invalid ID" }, { status: 400 });
  }

  const db = getDatabase();
  const image = db
    .select()
    .from(userImages)
    .where(and(eq(userImages.id, imgId), eq(userImages.modelId, modelId)))
    .get();

  if (!image) {
    return NextResponse.json({ error: "Image not found" }, { status: 404 });
  }

  const body = await request.json();
  const updates: Record<string, unknown> = {};

  if (body.prompt !== undefined) {
    updates.prompt = body.prompt;
  }

  if (body.nsfwLevel !== undefined) {
    updates.nsfwLevel = body.nsfwLevel;
  }

  if (body.sortOrder !== undefined) {
    updates.sortOrder = body.sortOrder;
  }

  if (body.generationParams !== undefined) {
    updates.generationParams = body.generationParams;
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json(
      { error: "No valid fields to update" },
      { status: 400 }
    );
  }

  db.update(userImages)
    .set(updates)
    .where(eq(userImages.id, imgId))
    .run();

  const updated = db
    .select()
    .from(userImages)
    .where(eq(userImages.id, imgId))
    .get();

  return NextResponse.json(updated);
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; imageId: string }> }
) {
  const { id, imageId } = await params;
  const modelId = parseInt(id, 10);
  const imgId = parseInt(imageId, 10);

  if (isNaN(modelId) || isNaN(imgId)) {
    return NextResponse.json({ error: "Invalid ID" }, { status: 400 });
  }

  const db = getDatabase();
  const image = db
    .select()
    .from(userImages)
    .where(and(eq(userImages.id, imgId), eq(userImages.modelId, modelId)))
    .get();

  if (!image) {
    return NextResponse.json({ error: "Image not found" }, { status: 404 });
  }

  // Delete files from disk
  if (image.localPath && existsSync(image.localPath)) {
    try {
      await unlink(image.localPath);
    } catch (err) {
      console.error("Failed to delete image file:", err);
    }
  }

  if (image.thumbPath && existsSync(image.thumbPath)) {
    try {
      await unlink(image.thumbPath);
    } catch (err) {
      console.error("Failed to delete thumbnail:", err);
    }
  }

  // Delete from database
  db.delete(userImages).where(eq(userImages.id, imgId)).run();

  return NextResponse.json({ success: true });
}

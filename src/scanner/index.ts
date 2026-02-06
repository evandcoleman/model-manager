import fs from "fs";
import { eq } from "drizzle-orm";
import { walkModelDirectory } from "./walker";
import { parseModelDict, parseImageSidecar, findLocalVersion } from "./parser";
import { generateThumbnails } from "./thumbnails";
import { createDatabase } from "../db";
import { models, modelVersions, modelFiles, images } from "../db/schema";
import type { AppConfig } from "../lib/config";
import type { ScannedModelEntry } from "./types";

export interface ScanResult {
  totalModels: number;
  totalFiles: number;
  totalImages: number;
  totalThumbnails: number;
  withMetadata: number;
  withoutMetadata: number;
}

export async function runScanner(config: AppConfig): Promise<ScanResult> {
  console.log(`Scanning model directory: ${config.modelDir}`);

  // 1. Walk model directory
  const entries = walkModelDirectory(config.modelDir);
  console.log(`Found ${entries.length} model files`);

  // 2. Group entries by model ID (same model can have multiple version files)
  const modelGroups = new Map<number, ScannedModelEntry[]>();
  for (const entry of entries) {
    const id = entry.modelId!;
    const group = modelGroups.get(id);
    if (group) {
      group.push(entry);
    } else {
      modelGroups.set(id, [entry]);
    }
  }
  console.log(`Found ${modelGroups.size} unique models`);

  // 3. Create/connect database
  const db = createDatabase(config.dbPath);

  // 4. Clear existing data (full rebuild)
  db.delete(images).run();
  db.delete(modelFiles).run();
  db.delete(modelVersions).run();
  db.delete(models).run();

  const now = new Date().toISOString();
  let totalImages = 0;
  let withMetadata = 0;
  let withoutMetadata = 0;
  const allImagePaths: string[] = [];
  const insertedVersionIds = new Set<number>();

  // 5. Insert models
  for (const [modelId, groupEntries] of modelGroups) {
    // Use the first entry with metadata, or just the first entry
    const primary =
      groupEntries.find((e) => e.modelDict) ?? groupEntries[0];
    const hasMetadata = !!primary.modelDict;
    if (hasMetadata) withMetadata++;
    else withoutMetadata++;

    const parsed = primary.modelDict
      ? parseModelDict(primary.modelDict)
      : null;

    const fileStats = fs.statSync(primary.safetensorsPath);

    // Determine base model from the local version if available
    let baseModel: string | null = null;
    if (primary.modelDict && primary.versionId) {
      const localVersion = findLocalVersion(
        primary.modelDict,
        primary.versionId
      );
      baseModel = localVersion?.baseModel ?? null;
    }

    // Insert model
    db.insert(models)
      .values({
        id: modelId,
        name: primary.modelName,
        type: parsed?.type ?? primary.category,
        description: parsed?.description ?? null,
        filePath: primary.safetensorsPath,
        fileSize: fileStats.size,
        category: primary.category,
        subcategory: primary.subcategory ?? null,
        baseModel,
        nsfwLevel: parsed?.nsfwLevel ?? 0,
        creatorName: parsed?.creatorName ?? null,
        creatorAvatar: parsed?.creatorAvatar ?? null,
        tags: parsed?.tags ?? [],
        stats: parsed?.stats ?? {},
        trainedWords: [],
        licensingInfo: parsed?.licensingInfo ?? {},
        hasMetadata,
        scannedAt: now,
      })
      .run();

    // Insert versions from model dict (only once per model)
    if (primary.modelDict?.modelVersions) {
      // Build map of versionId -> local file info
      const localVersionMap = new Map<
        number,
        { path: string; size: number }
      >();
      for (const entry of groupEntries) {
        if (entry.versionId) {
          const stats = fs.statSync(entry.safetensorsPath);
          localVersionMap.set(entry.versionId, {
            path: entry.safetensorsPath,
            size: stats.size,
          });
        }
      }

      for (const version of primary.modelDict.modelVersions) {
        if (insertedVersionIds.has(version.id)) continue;
        insertedVersionIds.add(version.id);

        const localInfo = localVersionMap.get(version.id);

        db.insert(modelVersions)
          .values({
            id: version.id,
            modelId,
            name: version.name,
            baseModel: version.baseModel ?? null,
            description: version.description ?? null,
            stats: version.stats ?? {},
            publishedAt: version.publishedAt ?? null,
            trainedWords: version.trainedWords ?? [],
            isLocal: localInfo != null,
            localPath: localInfo?.path ?? null,
            localFileSize: localInfo?.size ?? null,
          })
          .run();

        // Insert files for this version
        if (version.files) {
          for (const file of version.files) {
            db.insert(modelFiles)
              .values({
                id: file.id,
                versionId: version.id,
                fileName: file.name,
                sizeKb: file.sizeKB,
                format: file.metadata?.format ?? null,
                precision: file.metadata?.fp ?? null,
                hashes: file.hashes ?? {},
                scanResults: {
                  pickleScanResult: file.pickleScanResult,
                  virusScanResult: file.virusScanResult,
                },
              })
              .run();
          }
        }
      }
    }

    // For entries without metadata that also lack a version in the dict
    for (const entry of groupEntries) {
      if (entry.versionId && !insertedVersionIds.has(entry.versionId)) {
        insertedVersionIds.add(entry.versionId);
        const stats = fs.statSync(entry.safetensorsPath);

        // Use epoch as version name if present, otherwise "Local"
        const versionName = entry.epoch != null ? `Epoch ${entry.epoch}` : "Local";

        db.insert(modelVersions)
          .values({
            id: entry.versionId,
            modelId,
            name: versionName,
            baseModel: null,
            description: null,
            stats: {},
            publishedAt: null,
            trainedWords: [],
            isLocal: true,
            localPath: entry.safetensorsPath,
            localFileSize: stats.size,
          })
          .run();
      }

      // Insert images from local files
      for (let i = 0; i < entry.localImages.length; i++) {
        const img = entry.localImages[i];
        const imgParsed = img.sidecar
          ? parseImageSidecar(img.sidecar)
          : null;

        allImagePaths.push(img.path);

        db.insert(images)
          .values({
            modelId,
            versionId: entry.versionId ?? null,
            localPath: img.path,
            thumbPath: null,
            width: imgParsed?.width ?? null,
            height: imgParsed?.height ?? null,
            nsfwLevel: imgParsed?.nsfwLevel ?? 0,
            prompt: imgParsed?.prompt ?? null,
            generationParams: imgParsed?.generationParams as
              | (typeof images.$inferSelect)["generationParams"]
              | null,
            blurhash: imgParsed?.blurhash ?? null,
            sortOrder: i,
          })
          .run();

        totalImages++;
      }
    }
  }

  // 6. Generate thumbnails
  console.log(`Generating thumbnails for ${allImagePaths.length} images...`);
  const thumbMap = await generateThumbnails(allImagePaths, config.thumbDir);
  console.log(`Generated ${thumbMap.size} thumbnails`);

  // Update image records with thumbnail paths
  for (const [imagePath, thumbPath] of thumbMap) {
    db.update(images)
      .set({ thumbPath })
      .where(eq(images.localPath, imagePath))
      .run();
  }

  const result: ScanResult = {
    totalModels: modelGroups.size,
    totalFiles: entries.length,
    totalImages,
    totalThumbnails: thumbMap.size,
    withMetadata,
    withoutMetadata,
  };

  console.log("Scan complete:", result);
  return result;
}

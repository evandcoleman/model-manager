/**
 * Backfill image metadata from CivitAI API.
 *
 * This script finds images in the database that are missing prompt/generationParams
 * and fetches the metadata from CivitAI using the image IDs extracted from filenames.
 *
 * Usage:
 *   npx tsx src/scanner/backfill-image-metadata.ts [--dry-run]
 *
 * Environment:
 *   CIVITAI_API_KEY - Your CivitAI API key (required)
 */

import fs from "fs/promises";
import path from "path";
import { drizzle } from "drizzle-orm/better-sqlite3";
import Database from "better-sqlite3";
import { eq, isNull, or, sql } from "drizzle-orm";
import { createConfig } from "../lib/config";
import { images } from "../db/schema";
import { parseGenerationParams } from "./parser";
import type { CivitaiImageMeta, ImageSidecar } from "./types";

interface CivitaiApiImage {
  id: number;
  url: string;
  hash?: string;
  width: number;
  height: number;
  nsfwLevel: number | string;
  browsingLevel?: number;
  meta?: {
    id?: number;
    meta?: CivitaiImageMeta;
  } | CivitaiImageMeta;
}

interface CivitaiImagesResponse {
  items: CivitaiApiImage[];
  metadata: {
    totalItems?: number;
    currentPage?: number;
    pageSize?: number;
  };
}

const CIVITAI_API_KEY = process.env.CIVITAI_API_KEY;
const API_BASE = "https://civitai.com/api/v1";
const RATE_LIMIT_DELAY = 200; // ms between API calls to avoid rate limiting

async function fetchImageMetadata(
  imageId: number
): Promise<CivitaiApiImage | null> {
  const url = `${API_BASE}/images?imageId=${imageId}`;

  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${CIVITAI_API_KEY}`,
      "Content-Type": "application/json",
    },
  });

  if (!res.ok) {
    if (res.status === 404) return null;
    if (res.status === 429) {
      console.warn("  Rate limited, waiting 30s...");
      await sleep(30000);
      return fetchImageMetadata(imageId); // Retry
    }
    throw new Error(`CivitAI API error: ${res.status} ${res.statusText}`);
  }

  const data: CivitaiImagesResponse = await res.json();
  return data.items?.[0] ?? null;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function extractImageIdFromPath(localPath: string): number | null {
  // Extract filename like "117019443.jpeg" and parse the ID
  const filename = path.basename(localPath);
  const match = filename.match(/^(\d+)\.(jpeg|jpg|png|webp)$/i);
  if (match) {
    return parseInt(match[1], 10);
  }
  return null;
}

async function updateSidecarFile(
  localPath: string,
  apiImage: CivitaiApiImage,
  imageMeta: CivitaiImageMeta | undefined,
  nsfwLevel: number
): Promise<boolean> {
  // Sidecar file has same name with .image.json extension
  const sidecarPath = localPath.replace(
    /\.(jpeg|jpg|png|webp)$/i,
    ".image.json"
  );

  try {
    await fs.access(sidecarPath);
  } catch {
    // No sidecar file exists, skip
    return false;
  }

  try {
    const content = await fs.readFile(sidecarPath, "utf-8");
    const sidecar: ImageSidecar = JSON.parse(content);

    // Only update if meta is missing
    if (!sidecar.meta || !sidecar.meta.prompt) {
      sidecar.meta = imageMeta;
      sidecar.width = apiImage.width;
      sidecar.height = apiImage.height;
      sidecar.nsfwLevel = nsfwLevel;
      if (apiImage.hash) sidecar.hash = apiImage.hash;

      await fs.writeFile(sidecarPath, JSON.stringify(sidecar, null, 2));
      return true;
    }
  } catch (err) {
    console.warn(`  Failed to update sidecar: ${err}`);
  }

  return false;
}

async function main() {
  const dryRun = process.argv.includes("--dry-run");

  if (!CIVITAI_API_KEY) {
    console.error("Error: CIVITAI_API_KEY environment variable is required");
    console.error("Usage: CIVITAI_API_KEY=xxx npx tsx src/scanner/backfill-image-metadata.ts");
    process.exit(1);
  }

  const config = createConfig();
  console.log("CivitAI Image Metadata Backfill");
  console.log("================================");
  console.log(`Database: ${config.dbPath}`);
  console.log(`Dry run: ${dryRun}`);
  console.log();

  const sqlite = new Database(config.dbPath);
  const db = drizzle(sqlite);

  // Find images missing prompt
  const missingMetadata = db
    .select({
      id: images.id,
      localPath: images.localPath,
      modelId: images.modelId,
    })
    .from(images)
    .where(
      or(
        isNull(images.prompt),
        eq(images.prompt, "")
      )
    )
    .all();

  console.log(`Found ${missingMetadata.length} images missing metadata`);
  console.log();

  let updated = 0;
  let skipped = 0;
  let failed = 0;
  let notFound = 0;

  for (const img of missingMetadata) {
    if (!img.localPath) {
      skipped++;
      continue;
    }

    const civitaiId = extractImageIdFromPath(img.localPath);
    if (!civitaiId) {
      console.log(`[${img.id}] Skipping - no CivitAI ID in filename: ${path.basename(img.localPath)}`);
      skipped++;
      continue;
    }

    console.log(`[${img.id}] Fetching metadata for CivitAI image ${civitaiId}...`);

    try {
      const apiImage = await fetchImageMetadata(civitaiId);

      if (!apiImage) {
        console.log(`  Image not found on CivitAI`);
        notFound++;
        await sleep(RATE_LIMIT_DELAY);
        continue;
      }

      // Handle nested meta structure from CivitAI API
      // API returns: { meta: { id, meta: { seed, steps, prompt, ... } } }
      // Or sometimes: { meta: { seed, steps, prompt, ... } } directly
      let imageMeta: CivitaiImageMeta | undefined;
      if (apiImage.meta) {
        if ('meta' in apiImage.meta && apiImage.meta.meta) {
          // Nested structure: meta.meta contains the generation params
          imageMeta = apiImage.meta.meta;
        } else if ('seed' in apiImage.meta || 'prompt' in apiImage.meta || 'comfy' in apiImage.meta) {
          // Direct structure: meta contains generation params directly
          imageMeta = apiImage.meta as CivitaiImageMeta;
        }
      }

      // Extract prompt from meta, or from comfy workflow if needed
      let prompt = imageMeta?.prompt;
      if (!prompt && imageMeta?.comfy) {
        try {
          const comfy = JSON.parse(imageMeta.comfy);
          const promptNodes = comfy?.prompt;
          if (promptNodes) {
            // Build a map of node outputs for resolving references
            const nodeOutputs = new Map<string, string>();

            // First pass: collect string values from PrimitiveStringMultiline nodes
            for (const [nodeId, node] of Object.entries(promptNodes) as Array<[string, {
              class_type?: string;
              inputs?: Record<string, unknown>;
              _meta?: { title?: string };
            }]>) {
              if (node.class_type === "PrimitiveStringMultiline" && node.inputs?.value) {
                const value = node.inputs.value;
                if (typeof value === 'string') {
                  nodeOutputs.set(nodeId, value);
                }
              }
            }

            // Second pass: look for text encode nodes with prompts
            for (const node of Object.values(promptNodes) as Array<{
              class_type?: string;
              inputs?: Record<string, unknown>;
              _meta?: { title?: string };
            }>) {
              // Look for text encode nodes with positive prompts
              if (node.class_type === "CLIPTextEncode" && node._meta?.title?.includes("Positive")) {
                const textInput = node.inputs?.text;
                if (typeof textInput === 'string') {
                  prompt = textInput;
                  break;
                }
                // Check if it's a node reference [nodeId, outputIndex]
                if (Array.isArray(textInput) && textInput.length === 2) {
                  const refNodeId = String(textInput[0]);
                  const refValue = nodeOutputs.get(refNodeId);
                  if (refValue) {
                    prompt = refValue;
                    break;
                  }
                }
              }
              // Also check TextEncodeQwen nodes
              if (node.class_type?.includes("TextEncode")) {
                const promptInput = node.inputs?.prompt;
                if (typeof promptInput === 'string') {
                  prompt = promptInput;
                  break;
                }
                // Check if it's a node reference
                if (Array.isArray(promptInput) && promptInput.length === 2) {
                  const refNodeId = String(promptInput[0]);
                  const refValue = nodeOutputs.get(refNodeId);
                  if (refValue) {
                    prompt = refValue;
                    break;
                  }
                }
              }
            }

            // Fallback: just grab the first PrimitiveStringMultiline value
            if (!prompt) {
              const firstValue = nodeOutputs.values().next().value;
              if (firstValue) {
                prompt = firstValue;
              }
            }
          }
        } catch {
          // Ignore JSON parse errors
        }
      }

      if (!prompt && !imageMeta) {
        console.log(`  No metadata in API response`);
        notFound++;
        await sleep(RATE_LIMIT_DELAY);
        continue;
      }

      const generationParams = parseGenerationParams(imageMeta);

      // Convert nsfwLevel to number if it's a string
      let nsfwLevel = 0;
      if (typeof apiImage.nsfwLevel === 'number') {
        nsfwLevel = apiImage.nsfwLevel;
      } else if (apiImage.browsingLevel) {
        nsfwLevel = apiImage.browsingLevel;
      }

      if (prompt) {
        console.log(`  Found prompt: "${prompt.slice(0, 60)}${prompt.length > 60 ? '...' : ''}"`);
      } else {
        console.log(`  Found generation params (no prompt text)`);
      }

      if (!dryRun) {
        // Update database
        db.update(images)
          .set({
            prompt: prompt ?? null,
            generationParams,
            width: apiImage.width,
            height: apiImage.height,
            nsfwLevel,
            blurhash: apiImage.hash ?? null,
          })
          .where(eq(images.id, img.id))
          .run();

        // Update sidecar file if it exists
        const sidecarUpdated = await updateSidecarFile(img.localPath, apiImage, imageMeta, nsfwLevel);
        if (sidecarUpdated) {
          console.log(`  Updated sidecar file`);
        }
      }

      updated++;
      await sleep(RATE_LIMIT_DELAY);
    } catch (err) {
      console.error(`  Error: ${err}`);
      failed++;
    }
  }

  console.log();
  console.log("Summary:");
  console.log(`  Updated: ${updated}`);
  console.log(`  Not found: ${notFound}`);
  console.log(`  Skipped: ${skipped}`);
  console.log(`  Failed: ${failed}`);

  if (dryRun) {
    console.log();
    console.log("(Dry run - no changes made)");
  }

  sqlite.close();
}

main().catch((err) => {
  console.error("Backfill failed:", err);
  process.exit(1);
});

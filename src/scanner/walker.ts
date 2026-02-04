import fs from "fs";
import path from "path";
import type { ScannedModelEntry, ImageSidecar } from "./types";

const SAFETENSORS_EXT = ".safetensors";
const IMAGE_EXTENSIONS = new Set([".jpg", ".jpeg", ".png", ".webp"]);
const FILENAME_PATTERN = /^(.+)-mid_(\d+)-vid_(\d+)\.safetensors$/;

function findImages(
  dir: string
): Array<{ path: string; sidecar?: ImageSidecar }> {
  if (!fs.existsSync(dir)) return [];

  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const imageFiles: Array<{ path: string; sidecar?: ImageSidecar }> = [];

  for (const entry of entries) {
    if (!entry.isFile()) continue;
    const ext = path.extname(entry.name).toLowerCase();
    if (!IMAGE_EXTENSIONS.has(ext)) continue;

    const imagePath = path.join(dir, entry.name);
    const baseName = path.basename(entry.name, ext);
    const sidecarPath = path.join(dir, `${baseName}.json`);

    let sidecar: ImageSidecar | undefined;
    if (fs.existsSync(sidecarPath)) {
      try {
        const raw = fs.readFileSync(sidecarPath, "utf-8");
        sidecar = JSON.parse(raw);
      } catch {
        // skip malformed sidecar
      }
    }

    imageFiles.push({ path: imagePath, sidecar });
  }

  return imageFiles;
}

function hashPath(filePath: string): number {
  let hash = 0;
  for (let i = 0; i < filePath.length; i++) {
    const char = filePath.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash |= 0;
  }
  return Math.abs(hash);
}

function inferCategory(relativePath: string): {
  category: string;
  subcategory?: string;
} {
  const parts = relativePath.split(path.sep);
  const category = parts[0] ?? "unknown";

  const categoryMap: Record<string, string> = {
    loras: "LoRA",
    diffusion_models: "Checkpoint",
    vae: "VAE",
    controlnet: "ControlNet",
    embeddings: "Embedding",
    upscale_models: "Upscaler",
  };

  return {
    category: categoryMap[category] ?? category,
    subcategory: parts[1] ?? undefined,
  };
}

export function walkModelDirectory(modelDir: string): ScannedModelEntry[] {
  const entries: ScannedModelEntry[] = [];

  function walk(dir: string) {
    let dirEntries: fs.Dirent[];
    try {
      dirEntries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }

    for (const entry of dirEntries) {
      const fullPath = path.join(dir, entry.name);

      if (entry.isDirectory()) {
        if (entry.name.startsWith("extra_data-")) continue;
        walk(fullPath);
        continue;
      }

      if (!entry.name.endsWith(SAFETENSORS_EXT)) continue;

      const relativePath = path.relative(modelDir, fullPath);
      const { category, subcategory } = inferCategory(relativePath);

      const match = entry.name.match(FILENAME_PATTERN);

      if (match) {
        const modelId = parseInt(match[2], 10);
        const versionId = parseInt(match[3], 10);
        const extraDataDir = path.join(dir, `extra_data-vid_${versionId}`);

        const localImages = fs.existsSync(extraDataDir)
          ? findImages(extraDataDir)
          : [];

        let modelDict;
        if (fs.existsSync(extraDataDir)) {
          const dictFiles = fs
            .readdirSync(extraDataDir)
            .filter((f) => f.startsWith("model_dict-"));
          if (dictFiles.length > 0) {
            try {
              const raw = fs.readFileSync(
                path.join(extraDataDir, dictFiles[0]),
                "utf-8"
              );
              modelDict = JSON.parse(raw);
            } catch {
              // skip malformed json
            }
          }
        }

        const modelName =
          modelDict?.name ??
          path.basename(dir);

        entries.push({
          safetensorsPath: fullPath,
          modelId,
          versionId,
          modelName,
          extraDataDir: fs.existsSync(extraDataDir)
            ? extraDataDir
            : undefined,
          modelDict,
          localImages,
          category,
          subcategory,
        });
      } else {
        // No CivitAI pattern — synthetic entry
        const syntheticId = hashPath(relativePath);
        entries.push({
          safetensorsPath: fullPath,
          modelId: syntheticId,
          modelName: path.basename(entry.name, SAFETENSORS_EXT),
          localImages: [],
          category,
          subcategory,
        });
      }
    }
  }

  walk(modelDir);
  return entries;
}

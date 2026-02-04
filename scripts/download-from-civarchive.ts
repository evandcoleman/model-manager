#!/usr/bin/env npx tsx

/**
 * Downloads a model from civarchive.com and saves it in the ComfyUI
 * directory format with CivitAI-compatible metadata.
 *
 * Usage:
 *   npx tsx scripts/download-from-civarchive.ts <civarchive-url> [--model-dir <path>]
 *   npm run download -- <civarchive-url>
 *
 * Example:
 *   npm run download -- https://civarchive.com/models/2189974?modelVersionId=2465814
 */

import fs from "fs";
import path from "path";
import os from "os";
import https from "https";
import http from "http";
import readline from "readline";

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const DEFAULT_MODEL_DIR = process.env.MODEL_DIR ?? "/Volumes/AI/models";
const CONFIG_PATH = path.join(os.homedir(), ".config", "model-manager", "config.json");

function loadConfig(): Record<string, string> {
  try {
    return JSON.parse(fs.readFileSync(CONFIG_PATH, "utf-8"));
  } catch {
    return {};
  }
}

function saveConfig(config: Record<string, string>): void {
  fs.mkdirSync(path.dirname(CONFIG_PATH), { recursive: true });
  fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2));
}

function getHfToken(): string | undefined {
  return process.env.HF_TOKEN ?? loadConfig().hfToken;
}

function saveHfToken(token: string): void {
  const config = loadConfig();
  config.hfToken = token;
  saveConfig(config);
}

const TYPE_DIR_MAP: Record<string, string> = {
  LORA: "loras",
  Checkpoint: "diffusion_models",
  VAE: "vae",
  ControlNet: "controlnet",
  TextualInversion: "embeddings",
  Upscaler: "upscale_models",
};

const BASE_MODEL_DIR_MAP: Record<string, string> = {
  ZImageTurbo: "zit",
  Qwen: "qwen",
  "Qwen Image": "qwen",
  "Flux.2 Klein 9B": "qwen",
};

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface CivArchivePageData {
  model: {
    id: number;
    name: string;
    type: string;
    description?: string;
    username?: string;
    creator_id?: string;
    downloadCount?: number;
    favoriteCount?: number;
    commentCount?: number;
    is_nsfw?: boolean;
    nsfw_level?: number;
    createdAt?: string;
    updatedAt?: string;
    tags?: string[];
    versions: Array<{ id: number; name: string; href: string }>;
    version: CivArchiveVersion;
  };
}

interface CivArchiveVersion {
  id: number;
  modelId?: number;
  name: string;
  baseModel?: string;
  baseModelType?: string;
  description?: string;
  createdAt?: string;
  updatedAt?: string;
  files: CivArchiveFile[];
  images?: CivArchiveImage[];
  trigger?: string[];
  mirrors?: CivArchiveMirror[];
}

interface CivArchiveFile {
  id: number;
  name: string;
  type: string;
  sizeKB?: number;
  sha256?: string;
  mirrors?: CivArchiveMirror[];
}

interface CivArchiveMirror {
  url: string;
  source: string;
  filename?: string;
  deletedAt?: string | null;
  is_gated?: boolean;
  is_paid?: boolean;
}

interface CivArchiveImage {
  id: number;
  url: string;
  nsfwLevel?: number;
  width?: number;
  height?: number;
  hash?: string;
  meta?: Record<string, unknown>;
}

// ---------------------------------------------------------------------------
// HTTP helpers
// ---------------------------------------------------------------------------

function prompt(question: string): Promise<string> {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

function fetchText(url: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const client = url.startsWith("https") ? https : http;
    client
      .get(url, { headers: { "User-Agent": "ModelManager/1.0" } }, (res) => {
        if (
          res.statusCode &&
          res.statusCode >= 300 &&
          res.statusCode < 400 &&
          res.headers.location
        ) {
          return fetchText(res.headers.location).then(resolve, reject);
        }
        const chunks: Buffer[] = [];
        res.on("data", (chunk: Buffer) => chunks.push(chunk));
        res.on("end", () => resolve(Buffer.concat(chunks).toString()));
        res.on("error", reject);
      })
      .on("error", reject);
  });
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

function formatDuration(seconds: number): string {
  if (seconds < 60) return `${Math.floor(seconds)}s`;
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  if (m < 60) return `${m}m ${s}s`;
  const h = Math.floor(m / 60);
  return `${h}h ${m % 60}m ${s}s`;
}

class HttpError extends Error {
  constructor(public statusCode: number, url: string, public body: string = "") {
    super(`HTTP ${statusCode} for ${url}`);
  }
}

function downloadFile(url: string, dest: string, extraHeaders: Record<string, string> = {}): Promise<void> {
  return new Promise((resolve, reject) => {
    const client = url.startsWith("https") ? https : http;
    const headers = { "User-Agent": "ModelManager/1.0", ...extraHeaders };
    client
      .get(url, { headers }, (res) => {
        if (
          res.statusCode &&
          res.statusCode >= 300 &&
          res.statusCode < 400 &&
          res.headers.location
        ) {
          // Strip auth headers when redirecting to a different host (e.g. HF -> CDN)
          const originHost = new URL(url).hostname;
          const redirectHost = new URL(res.headers.location, url).hostname;
          const redirectHeaders = originHost === redirectHost ? extraHeaders : {};
          return downloadFile(res.headers.location, dest, redirectHeaders).then(
            resolve,
            reject
          );
        }
        if (res.statusCode && res.statusCode >= 400) {
          const chunks: Buffer[] = [];
          res.on("data", (chunk: Buffer) => chunks.push(chunk));
          res.on("end", () => {
            const body = Buffer.concat(chunks).toString().slice(0, 2000);
            reject(new HttpError(res.statusCode!, url, body));
          });
          return;
        }

        const contentLength = parseInt(
          res.headers["content-length"] ?? "0",
          10
        );
        const file = fs.createWriteStream(dest);
        let downloaded = 0;
        const startTime = Date.now();
        const BAR_WIDTH = 30;

        const drawProgress = () => {
          const elapsed = (Date.now() - startTime) / 1000;
          const speed = elapsed > 0 ? downloaded / elapsed : 0;

          let line: string;
          if (contentLength > 0) {
            const fraction = downloaded / contentLength;
            const filled = Math.round(BAR_WIDTH * fraction);
            const bar = "█".repeat(filled) + "░".repeat(BAR_WIDTH - filled);
            const percent = (fraction * 100).toFixed(1);
            const eta = speed > 0 ? (contentLength - downloaded) / speed : 0;
            line = `  ${bar} ${percent}%  ${formatBytes(downloaded)}/${formatBytes(contentLength)}  ${formatBytes(speed)}/s  ${formatDuration(elapsed)} elapsed  ETA ${formatDuration(eta)}`;
          } else {
            line = `  ${formatBytes(downloaded)}  ${formatBytes(speed)}/s  ${formatDuration(elapsed)} elapsed`;
          }

          process.stdout.write(`\r${line}`);
        };

        const interval = setInterval(drawProgress, 250);

        res.on("data", (chunk: Buffer) => {
          downloaded += chunk.length;
        });
        res.pipe(file);
        file.on("finish", () => {
          clearInterval(interval);
          drawProgress();
          process.stdout.write("\n");
          file.close();
          resolve();
        });
        file.on("error", (err) => {
          clearInterval(interval);
          reject(err);
        });
        res.on("error", (err) => {
          clearInterval(interval);
          reject(err);
        });
      })
      .on("error", reject);
  });
}

// ---------------------------------------------------------------------------
// Parse civarchive page
// ---------------------------------------------------------------------------

function extractPageData(html: string): CivArchivePageData {
  const match = html.match(
    /<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/
  );
  if (!match) {
    throw new Error("Could not find __NEXT_DATA__ on the page");
  }
  const nextData = JSON.parse(match[1]);
  const pageProps = nextData.props?.pageProps;
  if (!pageProps?.model) {
    throw new Error("Could not extract model data from page");
  }
  return pageProps as CivArchivePageData;
}

// ---------------------------------------------------------------------------
// Build CivitAI-compatible model_dict
// ---------------------------------------------------------------------------

function buildModelDict(
  pageData: CivArchivePageData,
  version: CivArchiveVersion
): Record<string, unknown> {
  const model = pageData.model;
  const creatorName = model.username ?? model.creator_id ?? "Unknown";

  return {
    id: model.id,
    name: model.name,
    description: model.description ?? "",
    allowNoCredit: false,
    allowCommercialUse: "None",
    allowDerivatives: false,
    allowDifferentLicense: false,
    type: model.type,
    minor: false,
    sfwOnly: false,
    poi: false,
    nsfw: model.is_nsfw ?? false,
    nsfwLevel: model.nsfw_level ?? 0,
    availability: "Public",
    stats: {
      downloadCount: model.downloadCount ?? 0,
      thumbsUpCount: model.favoriteCount ?? 0,
      thumbsDownCount: 0,
      commentCount: model.commentCount ?? 0,
      tippedAmountCount: 0,
    },
    creator: {
      username: creatorName,
      image: null,
    },
    tags: model.tags ?? [],
    modelVersions: [
      {
        id: version.id,
        index: 0,
        name: version.name,
        baseModel: version.baseModel ?? null,
        baseModelType: version.baseModelType ?? "Standard",
        createdAt: version.createdAt ?? model.createdAt,
        publishedAt: version.createdAt ?? model.createdAt,
        status: "Published",
        availability: "Public",
        nsfwLevel: model.nsfw_level ?? 0,
        description: version.description ?? "",
        stats: {
          downloadCount: model.downloadCount ?? 0,
          thumbsUpCount: model.favoriteCount ?? 0,
          thumbsDownCount: 0,
        },
        files: version.files.map((f) => ({
          id: f.id,
          sizeKB: f.sizeKB ?? 0,
          name: f.name,
          type: f.type,
          pickleScanResult: "Success",
          virusScanResult: "Success",
          metadata: { format: "SafeTensor" },
          hashes: f.sha256 ? { SHA256: f.sha256.toUpperCase() } : {},
          primary: true,
        })),
        images: (version.images ?? []).map((img) => ({
          url: img.url,
          nsfwLevel: img.nsfwLevel ?? 0,
          width: img.width ?? 0,
          height: img.height ?? 0,
          hash: img.hash ?? "",
          type: "image",
        })),
        trainedWords: version.trigger ?? [],
      },
    ],
  };
}

function buildImageSidecar(img: CivArchiveImage): Record<string, unknown> {
  return {
    url: img.url,
    nsfwLevel: img.nsfwLevel ?? 0,
    width: img.width ?? 0,
    height: img.height ?? 0,
    hash: img.hash ?? "",
    type: "image",
    metadata: {
      hash: img.hash ?? "",
      size: 0,
      width: img.width ?? 0,
      height: img.height ?? 0,
    },
    meta: img.meta ?? null,
    availability: "Public",
    hasMeta: !!img.meta,
    hasPositivePrompt: false,
    onSite: false,
  };
}

// ---------------------------------------------------------------------------
// Find best download URL
// ---------------------------------------------------------------------------

interface MirrorOption {
  label: string;
  url: string;
  available: boolean;
}

function getAvailableMirrors(
  file: CivArchiveFile,
  versionId: number
): MirrorOption[] {
  const allMirrors = file.mirrors ?? [];

  const options: MirrorOption[] = allMirrors.map((m) => {
    const host = new URL(m.url).hostname;
    const filename = m.filename ? ` — ${m.filename}` : "";
    const available = !m.deletedAt && !m.is_gated && !m.is_paid;
    const status = m.deletedAt ? " [deleted]" : m.is_gated ? " [gated]" : m.is_paid ? " [paid]" : "";
    return {
      label: `${m.source} (${host})${filename}${status}`,
      url: m.url,
      available,
    };
  });

  // Always include civarchive fallback
  options.push({
    label: "civarchive (civarchive.com)",
    url: `https://civarchive.com/api/download/models/${versionId}`,
    available: true,
  });

  return options;
}

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------

function parseArgs(): { url: string; modelDir: string; outputDir?: string; downloadUrl?: string } {
  const args = process.argv.slice(2);
  let url = "";
  let modelDir = DEFAULT_MODEL_DIR;
  let outputDir: string | undefined;
  let downloadUrl: string | undefined;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--model-dir" && args[i + 1]) {
      modelDir = args[++i];
    } else if ((args[i] === "--output" || args[i] === "-o") && args[i + 1]) {
      outputDir = args[++i];
    } else if ((args[i] === "--url" || args[i] === "-u") && args[i + 1]) {
      downloadUrl = args[++i];
    } else if (!args[i].startsWith("-")) {
      url = args[i];
    }
  }

  if (!url) {
    console.error(
      "Usage: npm run download -- <civarchive-url> [options]"
    );
    console.error(
      "\nOptions:"
    );
    console.error(
      "  -o, --output <folder>    Output directory for the model"
    );
    console.error(
      "  -u, --url <url>          Custom download URL for the model file"
    );
    console.error(
      "  --model-dir <path>       Root model directory (default: /Volumes/AI/models)"
    );
    console.error(
      "\nExamples:"
    );
    console.error(
      "  npm run download -- https://civarchive.com/models/2189974?modelVersionId=2465814"
    );
    console.error(
      "  npm run download -- <civarchive-url> -u https://huggingface.co/.../model.safetensors"
    );
    process.exit(1);
  }

  return { url, modelDir, outputDir, downloadUrl };
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  const { url, modelDir, outputDir: outputDirOverride, downloadUrl: customDownloadUrl } = parseArgs();

  console.log("CivArchive Downloader");
  console.log("=====================");
  console.log(`  URL: ${url}`);
  if (customDownloadUrl) console.log(`  Download URL: ${customDownloadUrl}`);
  console.log(`  Model dir: ${modelDir}`);
  console.log();

  // 1. Fetch page and extract data
  console.log("Fetching model data...");
  const html = await fetchText(url);
  const pageData = extractPageData(html);
  const model = pageData.model;
  const version = model.version;

  console.log(`  Model: ${model.name} (${model.id})`);
  console.log(`  Type: ${model.type}`);
  console.log(`  Version: ${version.name} (${version.id})`);
  console.log(`  Base model: ${version.baseModel ?? "unknown"}`);
  if (version.trigger?.length) {
    console.log(`  Trigger words: ${version.trigger.join(", ")}`);
  }
  console.log();

  // 2. Choose file to download
  const files = version.files;
  if (files.length === 0) {
    console.error("No files found in this version");
    process.exit(1);
  }

  let modelFile: CivArchiveFile;
  if (files.length === 1) {
    modelFile = files[0];
    console.log(`File: ${modelFile.name}`);
  } else {
    console.log("Available files:");
    for (let i = 0; i < files.length; i++) {
      const f = files[i];
      const size = f.sizeKB ? `~${Math.round(f.sizeKB / 1024)} MB` : "unknown size";
      console.log(`  [${i + 1}] ${f.name} (${size})`);
    }
    const answer = await prompt(`\nSelect file [1-${files.length}]: `);
    const idx = parseInt(answer, 10) - 1;
    if (isNaN(idx) || idx < 0 || idx >= files.length) {
      console.error("Invalid selection");
      process.exit(1);
    }
    modelFile = files[idx];
  }

  // 3. Determine output directory
  const modelNameClean = model.name.replace(/[<>:"/\\|?*]/g, "");
  let outputDir: string;
  if (outputDirOverride) {
    // -o specifies the parent; model gets its own subfolder
    outputDir = path.join(path.resolve(outputDirOverride), modelNameClean);
  } else {
    const typeDir = TYPE_DIR_MAP[model.type] ?? "other";
    const baseModelDir =
      BASE_MODEL_DIR_MAP[version.baseModel ?? ""] ??
      version.baseModel?.toLowerCase().replace(/[^a-z0-9]+/g, "_") ??
      "unknown";
    outputDir = path.join(modelDir, typeDir, baseModelDir, modelNameClean);
  }
  const extraDataDir = path.join(outputDir, `extra_data-vid_${version.id}`);

  console.log(`Output: ${outputDir}`);
  fs.mkdirSync(extraDataDir, { recursive: true });

  // 4. Build filename matching the expected pattern
  const ext = path.extname(modelFile.name);
  const baseName = modelFile.name.replace(ext, "");
  const destFilename = `${baseName}-mid_${model.id}-vid_${version.id}${ext}`;
  const destPath = path.join(outputDir, destFilename);

  // 5. Download the model file
  if (fs.existsSync(destPath)) {
    console.log("Model file already exists, skipping download");
  } else {
    let downloadUrl: string;

    if (customDownloadUrl) {
      downloadUrl = customDownloadUrl;
    } else {
      const allMirrors = getAvailableMirrors(modelFile, version.id);
      const selectable = allMirrors.filter((m) => m.available);

      if (selectable.length === 1 && allMirrors.length === 1) {
        downloadUrl = selectable[0].url;
      } else {
        console.log("Mirrors:");
        let selectIdx = 1;
        const indexMap: Record<number, MirrorOption> = {};
        for (const m of allMirrors) {
          if (m.available) {
            console.log(`  [${selectIdx}] ${m.label}`);
            indexMap[selectIdx] = m;
            selectIdx++;
          } else {
            console.log(`   -  ${m.label}`);
          }
        }
        const maxIdx = selectIdx - 1;
        console.log(`  [c] Custom URL`);
        const answer = await prompt(`\nSelect mirror [1-${maxIdx}] or 'c' for custom: `);
        if (answer.toLowerCase() === "c") {
          downloadUrl = await prompt("Enter download URL: ");
          if (!downloadUrl) {
            console.error("No URL provided");
            process.exit(1);
          }
        } else {
          const idx = parseInt(answer, 10);
          if (isNaN(idx) || idx < 1 || !indexMap[idx]) {
            console.error("Invalid selection");
            process.exit(1);
          }
          downloadUrl = indexMap[idx].url;
        }
      }
    }

    console.log(`Downloading ${modelFile.name} (~${Math.round((modelFile.sizeKB ?? 0) / 1024)} MB)...`);
    console.log(`  From: ${downloadUrl}`);

    const cachedToken = getHfToken();
    let headers: Record<string, string> = {};
    if (cachedToken) {
      headers["Authorization"] = `Bearer ${cachedToken}`;
    }

    try {
      await downloadFile(downloadUrl, destPath, headers);
    } catch (err) {
      // Clean up partial file before retry
      if (fs.existsSync(destPath)) fs.unlinkSync(destPath);

      if (err instanceof HttpError) {
        console.error(`\n  HTTP ${err.statusCode}`);
        if (err.body) console.error(`  Response: ${err.body}`);

        if (err.statusCode === 401 || err.statusCode === 403) {
          const token = await prompt("\nEnter HuggingFace API token (hf_...), or press Enter to abort: ");
          if (!token) {
            process.exit(1);
          }
          headers["Authorization"] = `Bearer ${token}`;
          await downloadFile(downloadUrl, destPath, headers);
          // Save token for future runs
          saveHfToken(token);
          console.log(`  Token saved to ${CONFIG_PATH}`);
        } else {
          process.exit(1);
        }
      } else {
        throw err;
      }
    }
    console.log(`  Saved as: ${destFilename}`);
  }
  console.log();

  // 6. Save model_dict JSON
  const modelDict = buildModelDict(pageData, version);
  const dictPath = path.join(
    extraDataDir,
    `model_dict-mid_${model.id}-vid_${version.id}.json`
  );
  fs.writeFileSync(dictPath, JSON.stringify(modelDict, null, 2));
  console.log("Saved model_dict.json");

  // 7. Download images and save sidecar JSONs
  const images = version.images ?? [];
  if (images.length > 0) {
    console.log(`Downloading ${images.length} preview images...`);
    for (const img of images) {
      const ext = path.extname(new URL(img.url).pathname) || ".jpeg";
      const imgFilename = `${img.id}${ext}`;
      const imgPath = path.join(extraDataDir, imgFilename);
      const sidecarPath = path.join(extraDataDir, `${img.id}.json`);

      // Save sidecar JSON
      fs.writeFileSync(
        sidecarPath,
        JSON.stringify(buildImageSidecar(img), null, 2)
      );

      // Download image
      if (fs.existsSync(imgPath)) {
        console.log(`  ${imgFilename} (exists)`);
      } else {
        try {
          await downloadFile(img.url, imgPath);
          console.log(`  ${imgFilename}`);
        } catch (err) {
          console.error(`  Failed: ${imgFilename} — ${err}`);
        }
      }
    }
  }

  console.log();
  console.log("Done! Run `npm run scan` to index the new model.");
}

main().catch((err) => {
  console.error("Failed:", err);
  process.exit(1);
});

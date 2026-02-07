import type { SourceMetadata, SourceFile } from "../types";

interface HuggingFaceFileInfo {
  rfilename: string;
  size?: number;
  sha256?: string;
  lfs?: {
    sha256: string;
    size: number;
  };
}

export interface ParsedHuggingFaceUrl {
  owner: string;
  repo: string;
  branch: string;
  path: string;
}

export function parseHuggingFaceUrl(url: string): ParsedHuggingFaceUrl | null {
  // Handle various HuggingFace URL formats:
  // https://huggingface.co/owner/repo/blob/main/path/to/file.safetensors
  // https://huggingface.co/owner/repo/resolve/main/path/to/file.safetensors
  // https://huggingface.co/owner/repo/tree/main
  const blobMatch = url.match(
    /huggingface\.co\/([^/]+)\/([^/]+)\/(blob|resolve|tree)\/([^/]+)(?:\/(.+))?/
  );

  if (blobMatch) {
    return {
      owner: blobMatch[1],
      repo: blobMatch[2],
      branch: blobMatch[4],
      path: blobMatch[5] ?? "",
    };
  }

  // Handle simple repo URL: https://huggingface.co/owner/repo
  const simpleMatch = url.match(/huggingface\.co\/([^/]+)\/([^/]+)\/?$/);
  if (simpleMatch) {
    return {
      owner: simpleMatch[1],
      repo: simpleMatch[2],
      branch: "main",
      path: "",
    };
  }

  return null;
}

export function isHuggingFaceUrl(url: string): boolean {
  return /huggingface\.co\/[^/]+\/[^/]+/.test(url);
}

export async function fetchHuggingFaceMetadata(
  url: string,
  apiToken?: string
): Promise<SourceMetadata> {
  const parsed = parseHuggingFaceUrl(url);
  if (!parsed) {
    throw new Error("Invalid HuggingFace URL");
  }

  const headers: Record<string, string> = {
    "User-Agent": "ModelManager/1.0",
  };

  if (apiToken) {
    headers["Authorization"] = `Bearer ${apiToken}`;
  }

  // Try to get model info for better type/base model detection
  let modelTags: string[] = [];
  try {
    const apiUrl = `https://huggingface.co/api/models/${parsed.owner}/${parsed.repo}`;
    const response = await fetch(apiUrl, { headers });
    if (response.ok) {
      const modelInfo = await response.json();
      modelTags = modelInfo.tags ?? [];
    }
  } catch {
    // Ignore - we'll fall back to filename-based detection
  }

  // If a specific file is specified, use that directly
  if (parsed.path && parsed.path.match(/\.(safetensors|ckpt|pt|bin)$/i)) {
    const fileName = parsed.path.split("/").pop()!;
    const downloadUrl = getHuggingFaceDownloadUrl(
      parsed.owner,
      parsed.repo,
      parsed.branch,
      parsed.path,
      apiToken
    );

    return {
      source: "huggingface",
      modelId: hashString(`${parsed.owner}/${parsed.repo}`),
      modelName: parsed.repo,
      modelType: guessModelType(fileName, modelTags),
      versionId: hashString(`${parsed.owner}/${parsed.repo}/${parsed.branch}`),
      versionName: parsed.branch,
      baseModel: guessBaseModel(parsed.repo, modelTags),
      files: [
        {
          id: hashString(parsed.path),
          name: fileName,
          type: "Model",
          downloadUrl,
        },
      ],
    };
  }

  // Otherwise, list files in the repo and find model files
  // We already fetched model info above for tags, but we need to do it again if path was specified
  let modelInfo: { modelId?: string; tags?: string[] } = { tags: modelTags };

  if (modelTags.length === 0) {
    const apiUrl = `https://huggingface.co/api/models/${parsed.owner}/${parsed.repo}`;
    const response = await fetch(apiUrl, { headers });

    if (!response.ok) {
      if (response.status === 401) {
        throw new Error("HuggingFace token required for gated model");
      }
      if (response.status === 403) {
        throw new Error(
          "Access denied. You may need to accept the model's terms on HuggingFace."
        );
      }
      throw new Error(`Failed to fetch HuggingFace model: ${response.status}`);
    }

    modelInfo = await response.json();
    modelTags = modelInfo.tags ?? [];
  }

  // Get file list
  const filesUrl = `https://huggingface.co/api/models/${parsed.owner}/${parsed.repo}/tree/${parsed.branch}${parsed.path ? `/${parsed.path}` : ""}`;
  const filesResponse = await fetch(filesUrl, { headers });

  let fileList: HuggingFaceFileInfo[] = [];
  if (filesResponse.ok) {
    fileList = await filesResponse.json();
  }

  // Filter for model files
  const modelFiles = fileList.filter((f) =>
    f.rfilename.match(/\.(safetensors|ckpt|pt|bin)$/i)
  );

  if (modelFiles.length === 0) {
    throw new Error(
      "No model files found. Please specify a direct link to the file."
    );
  }

  const files: SourceFile[] = modelFiles.map((f) => ({
    id: hashString(f.rfilename),
    name: f.rfilename.split("/").pop()!,
    type: "Model",
    sizeKB: f.lfs?.size
      ? Math.round(f.lfs.size / 1024)
      : f.size
        ? Math.round(f.size / 1024)
        : undefined,
    sha256: f.lfs?.sha256 ?? f.sha256,
    downloadUrl: getHuggingFaceDownloadUrl(
      parsed.owner,
      parsed.repo,
      parsed.branch,
      f.rfilename,
      apiToken
    ),
  }));

  return {
    source: "huggingface",
    modelId: hashString(`${parsed.owner}/${parsed.repo}`),
    modelName: modelInfo.modelId ?? parsed.repo,
    modelType: guessModelType(files[0]?.name ?? "", modelTags),
    versionId: hashString(`${parsed.owner}/${parsed.repo}/${parsed.branch}`),
    versionName: parsed.branch,
    baseModel: guessBaseModel(parsed.repo, modelTags),
    files,
  };
}

export function getHuggingFaceDownloadUrl(
  owner: string,
  repo: string,
  branch: string,
  path: string,
  _apiToken?: string
): string {
  // Use resolve URL for direct downloads
  return `https://huggingface.co/${owner}/${repo}/resolve/${branch}/${path}`;
}

function guessModelType(filename: string, tags?: string[]): string {
  const lower = filename.toLowerCase();
  const tagStr = (tags ?? []).join(" ").toLowerCase();

  // Check filename first
  if (lower.includes("lora")) return "LORA";
  if (lower.includes("vae")) return "VAE";
  if (lower.includes("controlnet")) return "ControlNet";
  if (lower.includes("embedding") || lower.includes("textual"))
    return "TextualInversion";
  if (lower.includes("upscale") || lower.includes("esrgan")) return "Upscaler";

  // Check tags
  if (tagStr.includes("lora")) return "LORA";
  if (tagStr.includes("vae")) return "VAE";
  if (tagStr.includes("controlnet")) return "ControlNet";
  if (tagStr.includes("textual-inversion") || tagStr.includes("embedding"))
    return "TextualInversion";

  return "Diffusion Model";
}

function guessBaseModel(repoName: string, tags?: string[]): string | undefined {
  const combined = [repoName, ...(tags ?? [])].join(" ").toLowerCase();

  // Z Image Turbo
  if (combined.includes("zimageturbo") || combined.includes("z-image-turbo") ||
      combined.includes("zit") || combined.includes("z image turbo")) {
    return "ZImageTurbo";
  }

  // Flux models
  if (combined.includes("flux.1") || combined.includes("flux1")) {
    if (combined.includes("schnell")) return "Flux.1 S";
    if (combined.includes("dev")) return "Flux.1 D";
    return "Flux.1 S";
  }
  if (combined.includes("flux")) return "Flux.1 S";

  // SD models
  if (combined.includes("sdxl") || combined.includes("sd-xl")) return "SDXL 1.0";
  if (combined.includes("sd3.5") || combined.includes("sd-3.5")) return "SD 3.5";
  if (combined.includes("sd3") || combined.includes("sd-3")) return "SD 3";
  if (combined.includes("sd2.1") || combined.includes("sd-2.1")) return "SD 2.1";
  if (combined.includes("sd2") || combined.includes("sd-2")) return "SD 2.0";
  if (combined.includes("sd1.5") || combined.includes("sd-1.5") ||
      combined.includes("stable-diffusion-v1-5")) return "SD 1.5";
  if (combined.includes("sd1.4") || combined.includes("sd-1.4")) return "SD 1.4";

  // Pony
  if (combined.includes("pony")) return "Pony";

  // Illustrious
  if (combined.includes("illustrious")) return "Illustrious";

  return undefined;
}

function hashString(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return Math.abs(hash);
}

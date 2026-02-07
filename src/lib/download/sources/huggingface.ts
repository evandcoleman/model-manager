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
      modelType: guessModelType(fileName),
      versionId: hashString(`${parsed.owner}/${parsed.repo}/${parsed.branch}`),
      versionName: parsed.branch,
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

  const modelInfo = await response.json();

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
    modelType: guessModelType(files[0]?.name ?? ""),
    versionId: hashString(`${parsed.owner}/${parsed.repo}/${parsed.branch}`),
    versionName: parsed.branch,
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

function guessModelType(filename: string): string {
  const lower = filename.toLowerCase();
  if (lower.includes("lora")) return "LORA";
  if (lower.includes("vae")) return "VAE";
  if (lower.includes("controlnet")) return "ControlNet";
  if (lower.includes("embedding") || lower.includes("textual"))
    return "TextualInversion";
  if (lower.includes("upscale") || lower.includes("esrgan")) return "Upscaler";
  return "Checkpoint";
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

import type { SourceMetadata, SourceFile, SourceImage } from "../types";

interface CivitaiModel {
  id: number;
  name: string;
  type: string;
  description?: string;
  nsfw: boolean;
  nsfwLevel: number;
  tags?: string[];
  creator?: { username: string };
  modelVersions: CivitaiVersion[];
}

interface CivitaiVersion {
  id: number;
  name: string;
  baseModel?: string;
  baseModelType?: string;
  description?: string;
  createdAt?: string;
  files: CivitaiFile[];
  images: CivitaiImage[];
  trainedWords?: string[];
}

interface CivitaiFile {
  id: number;
  name: string;
  type: string;
  sizeKB?: number;
  metadata?: {
    format?: string;
    size?: string;
    fp?: string;
  };
  hashes?: {
    SHA256?: string;
  };
  downloadUrl?: string;
}

interface CivitaiImage {
  id: number;
  url: string;
  nsfwLevel?: number;
  width?: number;
  height?: number;
  hash?: string;
  meta?: Record<string, unknown>;
}

export function parseCivitaiUrl(
  url: string
): { modelId: number; versionId?: number } | null {
  // Handle civitai.com/models/123 or civitai.com/models/123?modelVersionId=456
  const modelMatch = url.match(/civitai\.com\/models\/(\d+)/);
  if (!modelMatch) return null;

  const modelId = parseInt(modelMatch[1], 10);
  const versionMatch = url.match(/modelVersionId=(\d+)/);
  const versionId = versionMatch ? parseInt(versionMatch[1], 10) : undefined;

  return { modelId, versionId };
}

export function isCivitaiUrl(url: string): boolean {
  return /civitai\.com\/models\/\d+/.test(url);
}

export async function fetchCivitaiMetadata(
  url: string,
  apiToken?: string
): Promise<SourceMetadata> {
  const parsed = parseCivitaiUrl(url);
  if (!parsed) {
    throw new Error("Invalid CivitAI URL");
  }

  const headers: Record<string, string> = {
    "User-Agent": "ModelManager/1.0",
  };

  if (apiToken) {
    headers["Authorization"] = `Bearer ${apiToken}`;
  }

  const apiUrl = `https://civitai.com/api/v1/models/${parsed.modelId}`;
  const response = await fetch(apiUrl, { headers });

  if (!response.ok) {
    if (response.status === 401 || response.status === 403) {
      throw new Error("CivitAI API token required or invalid");
    }
    throw new Error(`Failed to fetch CivitAI model: ${response.status}`);
  }

  const model: CivitaiModel = await response.json();

  // Find the requested version or use the first one
  let version: CivitaiVersion;
  if (parsed.versionId) {
    const found = model.modelVersions.find((v) => v.id === parsed.versionId);
    if (!found) {
      throw new Error(`Version ${parsed.versionId} not found`);
    }
    version = found;
  } else {
    version = model.modelVersions[0];
    if (!version) {
      throw new Error("No versions available");
    }
  }

  const files: SourceFile[] = version.files.map((f) => ({
    id: f.id,
    name: f.name,
    type: f.type,
    sizeKB: f.sizeKB,
    sha256: f.hashes?.SHA256,
    downloadUrl: getCivitaiDownloadUrl(version.id, f.id, apiToken),
  }));

  const images: SourceImage[] = version.images.map((img) => ({
    id: img.id,
    url: img.url,
    nsfwLevel: img.nsfwLevel,
    width: img.width,
    height: img.height,
    hash: img.hash,
    meta: img.meta,
  }));

  return {
    source: "civitai",
    modelId: model.id,
    modelName: model.name,
    modelType: model.type,
    versionId: version.id,
    versionName: version.name,
    baseModel: version.baseModel,
    files,
    images,
    triggerWords: version.trainedWords,
  };
}

export function getCivitaiDownloadUrl(
  versionId: number,
  fileId: number,
  apiToken?: string
): string {
  const baseUrl = `https://civitai.com/api/download/models/${versionId}`;
  const params = new URLSearchParams();

  // Specify the file if there are multiple
  params.set("type", "Model");

  if (apiToken) {
    params.set("token", apiToken);
  }

  return `${baseUrl}?${params.toString()}`;
}

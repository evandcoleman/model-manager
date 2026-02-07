export type DownloadSource = "civarchive" | "civitai" | "huggingface";

export type DownloadStatus =
  | "pending"
  | "downloading"
  | "completed"
  | "failed"
  | "cancelled";

export interface DownloadProgress {
  downloaded: number;
  total: number;
  speed: number; // bytes per second
  percent: number;
  eta: number; // seconds
}

export interface DownloadJob {
  id: string;
  url: string;
  source: DownloadSource;
  status: DownloadStatus;
  modelName?: string;
  modelId?: number;
  versionId?: number;
  versionName?: string;
  fileName?: string;
  filePath?: string;
  outputDir?: string;
  progress: DownloadProgress;
  error?: string;
  createdAt: string;
  updatedAt: string;
  completedAt?: string;
}

export interface SourceMetadata {
  source: DownloadSource;
  modelId: number;
  modelName: string;
  modelType: string;
  versionId: number;
  versionName: string;
  baseModel?: string;
  files: SourceFile[];
  images?: SourceImage[];
  triggerWords?: string[];
}

export interface SourceFile {
  id: number;
  name: string;
  type: string;
  sizeKB?: number;
  sha256?: string;
  downloadUrl?: string;
  mirrors?: SourceMirror[];
}

export interface SourceMirror {
  url: string;
  source: string;
  filename?: string;
  available: boolean;
}

export interface SourceImage {
  id: number;
  url: string;
  nsfwLevel?: number;
  width?: number;
  height?: number;
  hash?: string;
  meta?: Record<string, unknown>;
}

export interface ModelDict {
  id: number;
  name: string;
  description: string;
  type: string;
  nsfw: boolean;
  nsfwLevel: number;
  creator: { username: string; image: string | null };
  tags: string[];
  modelVersions: ModelVersionDict[];
  [key: string]: unknown;
}

export interface ModelVersionDict {
  id: number;
  name: string;
  baseModel: string | null;
  baseModelType: string;
  createdAt: string;
  publishedAt: string;
  files: unknown[];
  images: unknown[];
  trainedWords: string[];
  [key: string]: unknown;
}

export const TYPE_DIR_MAP: Record<string, string> = {
  LORA: "loras",
  Checkpoint: "diffusion_models",
  VAE: "vae",
  ControlNet: "controlnet",
  TextualInversion: "embeddings",
  Upscaler: "upscale_models",
};

export const BASE_MODEL_DIR_MAP: Record<string, string> = {
  ZImageTurbo: "zit",
  Qwen: "qwen",
  "Qwen Image": "qwen",
  "Flux.2 Klein 9B": "qwen",
};

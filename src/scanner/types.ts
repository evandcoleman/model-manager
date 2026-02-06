export interface CivitaiModelDict {
  id: number;
  name: string;
  description?: string;
  type: string;
  nsfw: boolean;
  nsfwLevel: number;
  minor: boolean;
  poi: boolean;
  allowNoCredit?: boolean;
  allowCommercialUse?: string;
  allowDerivatives?: boolean;
  allowDifferentLicense?: boolean;
  stats?: {
    downloadCount?: number;
    thumbsUpCount?: number;
    thumbsDownCount?: number;
    commentCount?: number;
    tippedAmountCount?: number;
  };
  creator?: {
    username: string;
    image?: string;
  };
  tags?: string[];
  modelVersions?: CivitaiModelVersion[];
}

export interface CivitaiModelVersion {
  id: number;
  index?: number;
  name: string;
  baseModel?: string;
  baseModelType?: string;
  description?: string;
  publishedAt?: string;
  nsfwLevel?: number;
  stats?: {
    downloadCount?: number;
    thumbsUpCount?: number;
    thumbsDownCount?: number;
  };
  files?: CivitaiModelFile[];
  images?: CivitaiVersionImage[];
  trainedWords?: string[];
}

export interface CivitaiModelFile {
  id: number;
  sizeKB: number;
  name: string;
  type: string;
  pickleScanResult?: string;
  virusScanResult?: string;
  metadata?: {
    format?: string;
    fp?: string;
  };
  hashes?: Record<string, string>;
  primary?: boolean;
}

export interface CivitaiVersionImage {
  url: string;
  nsfwLevel: number;
  width: number;
  height: number;
  hash?: string;
  type: string;
  meta?: CivitaiImageMeta;
}

export interface CivitaiImageMeta {
  seed?: number;
  steps?: number;
  prompt?: string;
  denoise?: number;
  sampler?: string;
  cfgScale?: number;
  scheduler?: string;
  vaes?: string[];
  additionalResources?: Array<{
    name: string;
    type: string;
    strength?: number;
    strengthClip?: number;
  }>;
  comfy?: string;
}

export interface ImageSidecar {
  url: string;
  nsfwLevel: number;
  width: number;
  height: number;
  hash?: string;
  type: string;
  meta?: CivitaiImageMeta;
  metadata?: {
    hash?: string;
    size?: number;
    width?: number;
    height?: number;
  };
}

export interface ScannedModelEntry {
  safetensorsPath: string;
  modelId?: number;
  versionId?: number;
  modelName: string;
  extraDataDir?: string;
  modelDict?: CivitaiModelDict;
  localImages: Array<{
    path: string;
    sidecar?: ImageSidecar;
  }>;
  category: string;
  subcategory?: string;
  epoch?: number; // For locally-trained models with epoch variants
}

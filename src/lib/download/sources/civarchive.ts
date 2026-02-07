import type {
  SourceMetadata,
  SourceFile,
  SourceMirror,
  SourceImage,
  ModelDict,
} from "../types";

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

export function parseCivArchiveUrl(
  url: string
): { modelId: number; versionId?: number } | null {
  const match = url.match(/civarchive\.com\/models\/(\d+)/);
  if (!match) return null;

  const modelId = parseInt(match[1], 10);
  const versionMatch = url.match(/modelVersionId=(\d+)/);
  const versionId = versionMatch ? parseInt(versionMatch[1], 10) : undefined;

  return { modelId, versionId };
}

export function isCivArchiveUrl(url: string): boolean {
  return /civarchive\.com\/models\/\d+/.test(url);
}

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

export async function fetchCivArchiveMetadata(
  url: string
): Promise<SourceMetadata> {
  const response = await fetch(url, {
    headers: { "User-Agent": "ModelManager/1.0" },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch civarchive page: ${response.status}`);
  }

  const html = await response.text();
  const pageData = extractPageData(html);
  const model = pageData.model;
  const version = model.version;

  const files: SourceFile[] = version.files.map((f) => ({
    id: f.id,
    name: f.name,
    type: f.type,
    sizeKB: f.sizeKB,
    sha256: f.sha256,
    mirrors: getAvailableMirrors(f, version.id),
  }));

  const images: SourceImage[] = (version.images ?? []).map((img) => ({
    id: img.id,
    url: img.url,
    nsfwLevel: img.nsfwLevel,
    width: img.width,
    height: img.height,
    hash: img.hash,
    meta: img.meta,
  }));

  return {
    source: "civarchive",
    modelId: model.id,
    modelName: model.name,
    modelType: model.type,
    versionId: version.id,
    versionName: version.name,
    baseModel: version.baseModel,
    files,
    images,
    triggerWords: version.trigger,
  };
}

function getAvailableMirrors(
  file: CivArchiveFile,
  versionId: number
): SourceMirror[] {
  const allMirrors = file.mirrors ?? [];

  const mirrors: SourceMirror[] = allMirrors.map((m) => ({
    url: m.url,
    source: m.source,
    filename: m.filename,
    available: !m.deletedAt && !m.is_gated && !m.is_paid,
  }));

  // Always include civarchive fallback
  mirrors.push({
    url: `https://civarchive.com/api/download/models/${versionId}`,
    source: "civarchive",
    available: true,
  });

  return mirrors;
}

export function buildModelDict(
  metadata: SourceMetadata,
  pageData?: CivArchivePageData
): ModelDict {
  const creatorName =
    pageData?.model?.username ??
    pageData?.model?.creator_id ??
    "Unknown";

  return {
    id: metadata.modelId,
    name: metadata.modelName,
    description: pageData?.model?.description ?? "",
    allowNoCredit: false,
    allowCommercialUse: "None",
    allowDerivatives: false,
    allowDifferentLicense: false,
    type: metadata.modelType,
    minor: false,
    sfwOnly: false,
    poi: false,
    nsfw: pageData?.model?.is_nsfw ?? false,
    nsfwLevel: pageData?.model?.nsfw_level ?? 0,
    availability: "Public",
    stats: {
      downloadCount: pageData?.model?.downloadCount ?? 0,
      thumbsUpCount: pageData?.model?.favoriteCount ?? 0,
      thumbsDownCount: 0,
      commentCount: pageData?.model?.commentCount ?? 0,
      tippedAmountCount: 0,
    },
    creator: {
      username: creatorName,
      image: null,
    },
    tags: pageData?.model?.tags ?? [],
    modelVersions: [
      {
        id: metadata.versionId,
        index: 0,
        name: metadata.versionName,
        baseModel: metadata.baseModel ?? null,
        baseModelType: "Standard",
        createdAt:
          pageData?.model?.version?.createdAt ??
          pageData?.model?.createdAt ??
          new Date().toISOString(),
        publishedAt:
          pageData?.model?.version?.createdAt ??
          pageData?.model?.createdAt ??
          new Date().toISOString(),
        status: "Published",
        availability: "Public",
        nsfwLevel: pageData?.model?.nsfw_level ?? 0,
        description: pageData?.model?.version?.description ?? "",
        stats: {
          downloadCount: pageData?.model?.downloadCount ?? 0,
          thumbsUpCount: pageData?.model?.favoriteCount ?? 0,
          thumbsDownCount: 0,
        },
        files: metadata.files.map((f) => ({
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
        images: (metadata.images ?? []).map((img) => ({
          url: img.url,
          nsfwLevel: img.nsfwLevel ?? 0,
          width: img.width ?? 0,
          height: img.height ?? 0,
          hash: img.hash ?? "",
          type: "image",
        })),
        trainedWords: metadata.triggerWords ?? [],
      },
    ],
  };
}

export function buildImageSidecar(img: SourceImage): Record<string, unknown> {
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

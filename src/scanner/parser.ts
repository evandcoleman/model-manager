import type {
  CivitaiModelDict,
  CivitaiImageMeta,
  ImageSidecar,
} from "./types";

export function parseModelDict(raw: CivitaiModelDict) {
  return {
    id: raw.id,
    name: raw.name,
    type: raw.type ?? "Unknown",
    description: raw.description ?? null,
    nsfwLevel: raw.nsfwLevel ?? 0,
    creatorName: raw.creator?.username ?? null,
    creatorAvatar: raw.creator?.image ?? null,
    tags: raw.tags ?? [],
    stats: raw.stats ?? {},
    licensingInfo: {
      allowNoCredit: raw.allowNoCredit,
      allowCommercialUse: raw.allowCommercialUse,
      allowDerivatives: raw.allowDerivatives,
      allowDifferentLicense: raw.allowDifferentLicense,
    },
  };
}

export function parseGenerationParams(meta?: CivitaiImageMeta | null) {
  if (!meta) return null;

  const params: Record<string, unknown> = {};

  if (meta.seed != null) params.seed = meta.seed;
  if (meta.steps != null) params.steps = meta.steps;
  if (meta.sampler) params.sampler = meta.sampler;
  if (meta.cfgScale != null) params.cfgScale = meta.cfgScale;
  if (meta.scheduler) params.scheduler = meta.scheduler;
  if (meta.denoise != null) params.denoise = meta.denoise;
  if (meta.vaes) params.vaes = meta.vaes;

  if (meta.additionalResources) {
    params.loras = meta.additionalResources
      .filter((r) => r.type === "lora")
      .map((r) => ({
        name: r.name.split(/[\\/]/).pop() ?? r.name,
        strength: r.strength ?? 1,
      }));
  }

  // Extract prompt from comfy JSON if not directly available
  if (!meta.prompt && meta.comfy) {
    try {
      const comfy = JSON.parse(meta.comfy);
      const promptNode = comfy?.prompt;
      if (promptNode) {
        for (const node of Object.values(promptNode) as Array<{
          class_type?: string;
          inputs?: { text?: string };
          _meta?: { title?: string };
        }>) {
          if (
            node.class_type === "CLIPTextEncode" &&
            node._meta?.title?.includes("Positive") &&
            node.inputs?.text
          ) {
            params.prompt = node.inputs.text;
            break;
          }
        }
      }
    } catch {
      // skip malformed comfy JSON
    }
  }

  return Object.keys(params).length > 0 ? params : null;
}

export function parseImageSidecar(sidecar: ImageSidecar) {
  return {
    width: sidecar.width ?? sidecar.metadata?.width,
    height: sidecar.height ?? sidecar.metadata?.height,
    nsfwLevel: sidecar.nsfwLevel ?? 0,
    blurhash: sidecar.hash ?? null,
    prompt: sidecar.meta?.prompt ?? null,
    generationParams: parseGenerationParams(sidecar.meta),
  };
}

export function findLocalVersion(
  modelDict: CivitaiModelDict,
  versionId: number
) {
  return modelDict.modelVersions?.find((v) => v.id === versionId);
}

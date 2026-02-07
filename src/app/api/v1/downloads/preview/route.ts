import { NextRequest, NextResponse } from "next/server";
import { getToken } from "@/lib/tokens";
import {
  fetchCivArchiveMetadata,
  isCivArchiveUrl,
} from "@/lib/download/sources/civarchive";
import { fetchCivitaiMetadata, isCivitaiUrl } from "@/lib/download/sources/civitai";
import {
  fetchHuggingFaceMetadata,
  isHuggingFaceUrl,
} from "@/lib/download/sources/huggingface";
import type { SourceMetadata } from "@/lib/download/types";
import { withApiAuth } from "@/lib/api-auth";

async function handler(request: NextRequest) {
  try {
    const body = await request.json();
    const { url } = body as { url: string };

    if (!url) {
      return NextResponse.json({ error: "url is required" }, { status: 400 });
    }

    let metadata: SourceMetadata;
    let source: string;

    if (isCivArchiveUrl(url)) {
      source = "civarchive";
      metadata = await fetchCivArchiveMetadata(url);
    } else if (isCivitaiUrl(url)) {
      source = "civitai";
      const token = getToken("civitai");
      metadata = await fetchCivitaiMetadata(url, token);
    } else if (isHuggingFaceUrl(url)) {
      source = "huggingface";
      const token = getToken("huggingface");
      metadata = await fetchHuggingFaceMetadata(url, token);
    } else {
      return NextResponse.json(
        { error: "Unsupported URL. Supported: civarchive, civitai, huggingface" },
        { status: 400 }
      );
    }

    return NextResponse.json({
      source,
      modelName: metadata.modelName,
      modelType: metadata.modelType,
      baseModel: metadata.baseModel,
      versionName: metadata.versionName,
      files: metadata.files.map((f) => ({
        name: f.name,
        sizeKB: f.sizeKB,
      })),
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to fetch metadata" },
      { status: 500 }
    );
  }
}

export const POST = withApiAuth(handler);

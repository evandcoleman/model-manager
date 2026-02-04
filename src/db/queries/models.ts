import { eq, like, desc, asc, sql, and, inArray } from "drizzle-orm";
import { models, modelVersions, modelFiles, images } from "../schema";
import type { DB } from "../index";
import type {
  ModelListItem,
  ModelDetail,
  VersionDetail,
  ImageInfo,
  FilterOptions,
  PaginatedResult,
} from "../../lib/types";

export interface ModelFilters {
  category?: string;
  subcategory?: string;
  baseModel?: string;
  type?: string;
  search?: string;
  tags?: string[];
  maxNsfwLevel?: number;
  hasMetadata?: boolean;
  sort?: "newest" | "oldest" | "name" | "downloads" | "likes";
  page?: number;
  limit?: number;
}

export function getModels(
  db: DB,
  filters: ModelFilters = {}
): PaginatedResult<ModelListItem> {
  const page = filters.page ?? 1;
  const limit = filters.limit ?? 40;
  const offset = (page - 1) * limit;

  const conditions = [];

  if (filters.category) {
    conditions.push(eq(models.category, filters.category));
  }
  if (filters.subcategory) {
    conditions.push(eq(models.subcategory, filters.subcategory));
  }
  if (filters.baseModel) {
    conditions.push(eq(models.baseModel, filters.baseModel));
  }
  if (filters.type) {
    conditions.push(eq(models.type, filters.type));
  }
  if (filters.search) {
    conditions.push(like(models.name, `%${filters.search}%`));
  }
  if (filters.maxNsfwLevel != null) {
    conditions.push(
      sql`${models.nsfwLevel} <= ${filters.maxNsfwLevel}`
    );
  }
  if (filters.hasMetadata != null) {
    conditions.push(eq(models.hasMetadata, filters.hasMetadata));
  }
  if (filters.tags && filters.tags.length > 0) {
    // Match models that have any of the specified tags
    const tagConditions = filters.tags.map(
      (tag) => sql`${models.tags} LIKE ${"%" + tag + "%"}`
    );
    conditions.push(sql`(${sql.join(tagConditions, sql` OR `)})`);
  }

  const where = conditions.length > 0 ? and(...conditions) : undefined;

  // Get total count
  const countResult = db
    .select({ count: sql<number>`count(*)` })
    .from(models)
    .where(where)
    .get();

  const total = countResult?.count ?? 0;

  // Determine sort order
  let orderBy;
  switch (filters.sort) {
    case "name":
      orderBy = asc(models.name);
      break;
    case "oldest":
      orderBy = asc(models.scannedAt);
      break;
    case "downloads":
      orderBy = sql`json_extract(${models.stats}, '$.downloadCount') DESC`;
      break;
    case "likes":
      orderBy = sql`json_extract(${models.stats}, '$.thumbsUpCount') DESC`;
      break;
    case "newest":
    default:
      orderBy = desc(models.scannedAt);
      break;
  }

  const rows = db
    .select()
    .from(models)
    .where(where)
    .orderBy(orderBy)
    .limit(limit)
    .offset(offset)
    .all();

  // Get hero images for all models in one query
  const modelIds = rows.map((r) => r.id);
  const heroImages =
    modelIds.length > 0
      ? db
          .select()
          .from(images)
          .where(
            and(
              inArray(images.modelId, modelIds),
              eq(images.sortOrder, 0)
            )
          )
          .all()
      : [];

  const heroMap = new Map(heroImages.map((img) => [img.modelId, img]));

  const items: ModelListItem[] = rows.map((row) => {
    const hero = heroMap.get(row.id);
    return {
      id: row.id,
      name: row.name,
      type: row.type,
      category: row.category ?? "",
      subcategory: row.subcategory,
      baseModel: row.baseModel,
      nsfwLevel: row.nsfwLevel ?? 0,
      creatorName: row.creatorName,
      creatorAvatar: row.creatorAvatar,
      tags: (row.tags as string[]) ?? [],
      stats: (row.stats as ModelListItem["stats"]) ?? {},
      hasMetadata: row.hasMetadata,
      heroImage: hero
        ? {
            id: hero.id,
            thumbPath: hero.thumbPath,
            width: hero.width,
            height: hero.height,
            nsfwLevel: hero.nsfwLevel ?? 0,
            blurhash: hero.blurhash,
          }
        : null,
    };
  });

  return {
    items,
    total,
    page,
    limit,
    hasMore: offset + limit < total,
  };
}

export function getModelById(db: DB, id: number): ModelDetail | null {
  const model = db.select().from(models).where(eq(models.id, id)).get();
  if (!model) return null;

  const versions = db
    .select()
    .from(modelVersions)
    .where(eq(modelVersions.modelId, id))
    .all();

  const versionDetails: VersionDetail[] = versions.map((v) => {
    const files = db
      .select()
      .from(modelFiles)
      .where(eq(modelFiles.versionId, v.id))
      .all()
      .map((f) => ({
        id: f.id,
        fileName: f.fileName,
        sizeKb: f.sizeKb,
        format: f.format,
        precision: f.precision,
      }));

    const versionImages = db
      .select()
      .from(images)
      .where(eq(images.versionId, v.id))
      .orderBy(asc(images.sortOrder))
      .all()
      .map((img) => ({
        id: img.id,
        localPath: img.localPath,
        thumbPath: img.thumbPath,
        width: img.width,
        height: img.height,
        nsfwLevel: img.nsfwLevel ?? 0,
        prompt: img.prompt,
        generationParams: img.generationParams as ImageInfo["generationParams"],
        blurhash: img.blurhash,
        sortOrder: img.sortOrder ?? 0,
      }));

    return {
      id: v.id,
      name: v.name,
      baseModel: v.baseModel,
      description: v.description,
      stats: (v.stats as VersionDetail["stats"]) ?? {},
      publishedAt: v.publishedAt,
      trainedWords: (v.trainedWords as string[]) ?? [],
      isLocal: v.isLocal,
      files,
      images: versionImages,
    };
  });

  // Sort: local versions first, then by index
  versionDetails.sort((a, b) => {
    if (a.isLocal && !b.isLocal) return -1;
    if (!a.isLocal && b.isLocal) return 1;
    return 0;
  });

  return {
    id: model.id,
    name: model.name,
    type: model.type,
    description: model.description,
    filePath: model.filePath,
    fileSize: model.fileSize,
    category: model.category ?? "",
    subcategory: model.subcategory,
    baseModel: model.baseModel,
    nsfwLevel: model.nsfwLevel ?? 0,
    creatorName: model.creatorName,
    creatorAvatar: model.creatorAvatar,
    tags: (model.tags as string[]) ?? [],
    stats: (model.stats as ModelDetail["stats"]) ?? {},
    trainedWords: (model.trainedWords as string[]) ?? [],
    licensingInfo:
      (model.licensingInfo as ModelDetail["licensingInfo"]) ?? {},
    hasMetadata: model.hasMetadata,
    versions: versionDetails,
  };
}

export function getFilterOptions(db: DB): FilterOptions {
  const categories = db
    .selectDistinct({ category: models.category })
    .from(models)
    .all()
    .map((r) => r.category)
    .filter((c): c is string => c != null)
    .sort();

  const baseModels = db
    .selectDistinct({ baseModel: models.baseModel })
    .from(models)
    .all()
    .map((r) => r.baseModel)
    .filter((b): b is string => b != null)
    .sort();

  const types = db
    .selectDistinct({ type: models.type })
    .from(models)
    .all()
    .map((r) => r.type)
    .sort();

  // Aggregate all tags
  const allTags = db
    .select({ tags: models.tags })
    .from(models)
    .all();

  const tagSet = new Set<string>();
  for (const row of allTags) {
    const tags = row.tags as string[] | null;
    if (tags) {
      for (const tag of tags) {
        tagSet.add(tag);
      }
    }
  }

  return {
    categories,
    baseModels,
    tags: Array.from(tagSet).sort(),
    types,
  };
}

import { sqliteTable, text, integer, real } from "drizzle-orm/sqlite-core";

export const models = sqliteTable("models", {
  id: integer("id").primaryKey(),
  name: text("name").notNull(),
  type: text("type").notNull(),
  description: text("description"),
  filePath: text("file_path").notNull(),
  fileSize: real("file_size"),
  category: text("category"),
  subcategory: text("subcategory"),
  baseModel: text("base_model"),
  nsfwLevel: integer("nsfw_level").default(0),
  creatorName: text("creator_name"),
  creatorAvatar: text("creator_avatar"),
  tags: text("tags", { mode: "json" }).$type<string[]>(),
  stats: text("stats", { mode: "json" }).$type<{
    downloadCount?: number;
    thumbsUpCount?: number;
    thumbsDownCount?: number;
    commentCount?: number;
    tippedAmountCount?: number;
  }>(),
  trainedWords: text("trained_words", { mode: "json" }).$type<string[]>(),
  licensingInfo: text("licensing_info", { mode: "json" }).$type<{
    allowNoCredit?: boolean;
    allowCommercialUse?: string;
    allowDerivatives?: boolean;
    allowDifferentLicense?: boolean;
  }>(),
  hasMetadata: integer("has_metadata", { mode: "boolean" })
    .notNull()
    .default(false),
  scannedAt: text("scanned_at").notNull(),
});

export const modelVersions = sqliteTable("model_versions", {
  id: integer("id").primaryKey(),
  modelId: integer("model_id")
    .notNull()
    .references(() => models.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  baseModel: text("base_model"),
  description: text("description"),
  stats: text("stats", { mode: "json" }).$type<{
    downloadCount?: number;
    thumbsUpCount?: number;
    thumbsDownCount?: number;
  }>(),
  publishedAt: text("published_at"),
  trainedWords: text("trained_words", { mode: "json" }).$type<string[]>(),
  isLocal: integer("is_local", { mode: "boolean" }).notNull().default(false),
  localPath: text("local_path"),
  localFileSize: real("local_file_size"),
});

export const modelFiles = sqliteTable("model_files", {
  id: integer("id").primaryKey(),
  versionId: integer("version_id")
    .notNull()
    .references(() => modelVersions.id, { onDelete: "cascade" }),
  fileName: text("file_name").notNull(),
  sizeKb: real("size_kb"),
  format: text("format"),
  precision: text("precision"),
  hashes: text("hashes", { mode: "json" }).$type<Record<string, string>>(),
  scanResults: text("scan_results", { mode: "json" }).$type<{
    pickleScanResult?: string;
    virusScanResult?: string;
  }>(),
});

export const images = sqliteTable("images", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  modelId: integer("model_id")
    .notNull()
    .references(() => models.id, { onDelete: "cascade" }),
  versionId: integer("version_id").references(() => modelVersions.id, {
    onDelete: "cascade",
  }),
  localPath: text("local_path"),
  thumbPath: text("thumb_path"),
  width: integer("width"),
  height: integer("height"),
  nsfwLevel: integer("nsfw_level").default(0),
  prompt: text("prompt"),
  generationParams: text("generation_params", { mode: "json" }).$type<{
    seed?: number;
    steps?: number;
    sampler?: string;
    cfgScale?: number;
    scheduler?: string;
    denoise?: number;
    loras?: Array<{ name: string; strength: number }>;
    vaes?: string[];
    width?: number;
    height?: number;
    negativePrompt?: string;
  }>(),
  blurhash: text("blurhash"),
  sortOrder: integer("sort_order").default(0),
});

// User-managed tables (no FK constraints to survive rescans)
export const userNotes = sqliteTable("user_notes", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  modelId: integer("model_id").notNull().unique(),
  content: text("content").notNull(),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});

export const userImages = sqliteTable("user_images", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  modelId: integer("model_id").notNull(),
  versionId: integer("version_id"),
  localPath: text("local_path").notNull(),
  thumbPath: text("thumb_path"),
  width: integer("width"),
  height: integer("height"),
  nsfwLevel: integer("nsfw_level").default(0),
  prompt: text("prompt"),
  generationParams: text("generation_params", { mode: "json" }).$type<{
    seed?: number;
    steps?: number;
    sampler?: string;
    cfgScale?: number;
    scheduler?: string;
    denoise?: number;
    loras?: Array<{ name: string; strength: number }>;
    vaes?: string[];
    width?: number;
    height?: number;
    negativePrompt?: string;
    comfyWorkflow?: Record<string, unknown>;
  }>(),
  blurhash: text("blurhash"),
  sortOrder: integer("sort_order").default(0),
  createdAt: text("created_at").notNull(),
});

export type Model = typeof models.$inferSelect;
export type ModelVersion = typeof modelVersions.$inferSelect;
export type ModelFile = typeof modelFiles.$inferSelect;
export type Image = typeof images.$inferSelect;
export type UserNote = typeof userNotes.$inferSelect;
export type UserImage = typeof userImages.$inferSelect;

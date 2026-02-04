import { NextRequest, NextResponse } from "next/server";
import { getDatabase } from "../../../db";
import { getModels, type ModelFilters } from "../../../db/queries/models";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;

  const filters: ModelFilters = {};

  const category = searchParams.get("category");
  if (category) filters.category = category;

  const subcategory = searchParams.get("subcategory");
  if (subcategory) filters.subcategory = subcategory;

  const baseModel = searchParams.get("baseModel");
  if (baseModel) filters.baseModel = baseModel;

  const type = searchParams.get("type");
  if (type) filters.type = type;

  const search = searchParams.get("search");
  if (search) filters.search = search;

  const tags = searchParams.get("tags");
  if (tags) filters.tags = tags.split(",").filter(Boolean);

  const maxNsfwLevel = searchParams.get("maxNsfwLevel");
  if (maxNsfwLevel) filters.maxNsfwLevel = parseInt(maxNsfwLevel, 10);

  const hasMetadata = searchParams.get("hasMetadata");
  if (hasMetadata != null) filters.hasMetadata = hasMetadata === "true";

  const sort = searchParams.get("sort") as ModelFilters["sort"];
  if (sort) filters.sort = sort;

  const page = searchParams.get("page");
  if (page) filters.page = parseInt(page, 10);

  const limit = searchParams.get("limit");
  if (limit) filters.limit = Math.min(parseInt(limit, 10), 100);

  const db = getDatabase();
  const result = getModels(db, filters);

  return NextResponse.json(result);
}

import { getDatabase } from "../db";
import { getModels, getFilterOptions } from "../db/queries/models";
import { Gallery } from "../components/gallery/gallery";
import { NsfwProvider } from "../components/providers/nsfw-provider";

export const dynamic = "force-dynamic";

export default function Home() {
  const db = getDatabase();
  const initialData = getModels(db, { page: 1, limit: 40, hasMetadata: true });
  const filterOptions = getFilterOptions(db);

  return (
    <NsfwProvider>
      <Gallery initialData={initialData} initialFilters={filterOptions} />
    </NsfwProvider>
  );
}

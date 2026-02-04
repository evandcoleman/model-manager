import { createConfig } from "../lib/config";
import { runScanner } from "./index";

async function main() {
  const config = createConfig();
  console.log("Model Manager Scanner");
  console.log("=====================");
  console.log(`Model directory: ${config.modelDir}`);
  console.log(`Data directory: ${config.dataDir}`);
  console.log();

  const result = await runScanner(config);

  console.log();
  console.log("Summary:");
  console.log(`  Models: ${result.totalModels}`);
  console.log(`    With metadata: ${result.withMetadata}`);
  console.log(`    Without metadata: ${result.withoutMetadata}`);
  console.log(`  Images: ${result.totalImages}`);
  console.log(`  Thumbnails: ${result.totalThumbnails}`);
}

main().catch((err) => {
  console.error("Scanner failed:", err);
  process.exit(1);
});

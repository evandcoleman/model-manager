#!/usr/bin/env npx tsx
import { getApiKey, regenerateApiKey } from "../lib/api-key";

const command = process.argv[2];

if (command === "show") {
  console.log("Current API key:", getApiKey());
} else if (command === "regenerate") {
  const key = regenerateApiKey();
  console.log("New API key:", key);
} else {
  console.log("Usage: npm run api-key [show|regenerate]");
}

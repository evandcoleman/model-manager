import { randomBytes } from "crypto";
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "fs";
import path from "path";
import { getConfig } from "./config";

interface ApiKeyData {
  key: string;
  createdAt: string;
}

function getKeyPath(): string {
  return path.join(getConfig().dataDir, "api-key.json");
}

export function getApiKey(): string {
  const keyPath = getKeyPath();
  if (!existsSync(keyPath)) {
    return regenerateApiKey();
  }
  const data: ApiKeyData = JSON.parse(readFileSync(keyPath, "utf-8"));
  return data.key;
}

export function regenerateApiKey(): string {
  const config = getConfig();
  if (!existsSync(config.dataDir)) {
    mkdirSync(config.dataDir, { recursive: true });
  }
  const key = randomBytes(32).toString("hex");
  const data: ApiKeyData = { key, createdAt: new Date().toISOString() };
  writeFileSync(getKeyPath(), JSON.stringify(data, null, 2));
  return key;
}

export function validateApiKey(providedKey: string): boolean {
  return providedKey === getApiKey();
}

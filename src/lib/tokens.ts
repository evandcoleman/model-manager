import { readFileSync, writeFileSync, existsSync, mkdirSync } from "fs";
import path from "path";
import { getConfig } from "./config";

export type TokenService = "civitai" | "huggingface";

export interface TokenStore {
  civitai?: string;
  huggingface?: string;
}

function getTokensPath(): string {
  return path.join(getConfig().dataDir, "tokens.json");
}

export function getTokens(): TokenStore {
  const tokensPath = getTokensPath();
  if (!existsSync(tokensPath)) {
    return {};
  }
  try {
    return JSON.parse(readFileSync(tokensPath, "utf-8"));
  } catch {
    return {};
  }
}

export function getToken(service: TokenService): string | undefined {
  return getTokens()[service];
}

export function setToken(service: TokenService, token: string): void {
  const config = getConfig();
  if (!existsSync(config.dataDir)) {
    mkdirSync(config.dataDir, { recursive: true });
  }
  const tokens = getTokens();
  tokens[service] = token;
  writeFileSync(getTokensPath(), JSON.stringify(tokens, null, 2));
}

export function clearToken(service: TokenService): void {
  const tokens = getTokens();
  delete tokens[service];
  const config = getConfig();
  if (!existsSync(config.dataDir)) {
    mkdirSync(config.dataDir, { recursive: true });
  }
  writeFileSync(getTokensPath(), JSON.stringify(tokens, null, 2));
}

export function getMaskedToken(token: string): string {
  if (token.length <= 8) {
    return "****";
  }
  return token.slice(0, 4) + "****" + token.slice(-4);
}

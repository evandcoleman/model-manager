import https from "https";
import http from "http";
import fs from "fs";
import type { DownloadProgress } from "./types";

export interface DownloadOptions {
  headers?: Record<string, string>;
  onProgress?: (progress: DownloadProgress) => void;
  signal?: AbortSignal;
}

export class HttpError extends Error {
  constructor(
    public statusCode: number,
    url: string,
    public body: string = ""
  ) {
    super(`HTTP ${statusCode} for ${url}`);
  }
}

export async function downloadFile(
  url: string,
  dest: string,
  options: DownloadOptions = {}
): Promise<void> {
  const { headers = {}, onProgress, signal } = options;

  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(new Error("Download cancelled"));
      return;
    }

    const client = url.startsWith("https") ? https : http;
    const requestHeaders = { "User-Agent": "ModelManager/1.0", ...headers };

    const req = client.get(url, { headers: requestHeaders }, (res) => {
      // Handle redirects
      if (
        res.statusCode &&
        res.statusCode >= 300 &&
        res.statusCode < 400 &&
        res.headers.location
      ) {
        // Strip auth headers when redirecting to a different host
        const originHost = new URL(url).hostname;
        const redirectUrl = new URL(res.headers.location, url).href;
        const redirectHost = new URL(redirectUrl).hostname;
        const redirectHeaders =
          originHost === redirectHost ? headers : {};

        downloadFile(redirectUrl, dest, {
          ...options,
          headers: redirectHeaders,
        }).then(resolve, reject);
        return;
      }

      // Handle errors
      if (res.statusCode && res.statusCode >= 400) {
        const chunks: Buffer[] = [];
        res.on("data", (chunk: Buffer) => chunks.push(chunk));
        res.on("end", () => {
          const body = Buffer.concat(chunks).toString().slice(0, 2000);
          reject(new HttpError(res.statusCode!, url, body));
        });
        return;
      }

      const contentLength = parseInt(
        res.headers["content-length"] ?? "0",
        10
      );
      const file = fs.createWriteStream(dest);
      let downloaded = 0;
      const startTime = Date.now();

      const updateProgress = () => {
        const elapsed = (Date.now() - startTime) / 1000;
        const speed = elapsed > 0 ? downloaded / elapsed : 0;
        const percent =
          contentLength > 0 ? (downloaded / contentLength) * 100 : 0;
        const eta =
          speed > 0 && contentLength > 0
            ? (contentLength - downloaded) / speed
            : 0;

        onProgress?.({
          downloaded,
          total: contentLength,
          speed,
          percent,
          eta,
        });
      };

      // Update progress periodically
      const interval = setInterval(updateProgress, 250);

      res.on("data", (chunk: Buffer) => {
        downloaded += chunk.length;
      });

      res.pipe(file);

      // Handle abort signal
      const onAbort = () => {
        clearInterval(interval);
        file.close();
        res.destroy();
        fs.unlink(dest, () => {});
        reject(new Error("Download cancelled"));
      };

      signal?.addEventListener("abort", onAbort, { once: true });

      file.on("finish", () => {
        clearInterval(interval);
        signal?.removeEventListener("abort", onAbort);
        updateProgress();
        file.close();
        resolve();
      });

      file.on("error", (err) => {
        clearInterval(interval);
        signal?.removeEventListener("abort", onAbort);
        fs.unlink(dest, () => {});
        reject(err);
      });

      res.on("error", (err) => {
        clearInterval(interval);
        signal?.removeEventListener("abort", onAbort);
        fs.unlink(dest, () => {});
        reject(err);
      });
    });

    req.on("error", reject);

    // Handle abort signal for the request itself
    const onAbort = () => {
      req.destroy();
      reject(new Error("Download cancelled"));
    };
    signal?.addEventListener("abort", onAbort, { once: true });
  });
}

export async function downloadToBuffer(
  url: string,
  headers: Record<string, string> = {}
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const client = url.startsWith("https") ? https : http;
    const requestHeaders = { "User-Agent": "ModelManager/1.0", ...headers };

    client
      .get(url, { headers: requestHeaders }, (res) => {
        // Handle redirects
        if (
          res.statusCode &&
          res.statusCode >= 300 &&
          res.statusCode < 400 &&
          res.headers.location
        ) {
          const originHost = new URL(url).hostname;
          const redirectUrl = new URL(res.headers.location, url).href;
          const redirectHost = new URL(redirectUrl).hostname;
          const redirectHeaders =
            originHost === redirectHost ? headers : {};

          downloadToBuffer(redirectUrl, redirectHeaders).then(
            resolve,
            reject
          );
          return;
        }

        if (res.statusCode && res.statusCode >= 400) {
          const chunks: Buffer[] = [];
          res.on("data", (chunk: Buffer) => chunks.push(chunk));
          res.on("end", () => {
            const body = Buffer.concat(chunks).toString().slice(0, 2000);
            reject(new HttpError(res.statusCode!, url, body));
          });
          return;
        }

        const chunks: Buffer[] = [];
        res.on("data", (chunk: Buffer) => chunks.push(chunk));
        res.on("end", () => resolve(Buffer.concat(chunks)));
        res.on("error", reject);
      })
      .on("error", reject);
  });
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024)
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

export function formatDuration(seconds: number): string {
  if (seconds < 60) return `${Math.floor(seconds)}s`;
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  if (m < 60) return `${m}m ${s}s`;
  const h = Math.floor(m / 60);
  return `${h}h ${m % 60}m ${s}s`;
}

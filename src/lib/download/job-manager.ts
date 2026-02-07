import fs from "fs";
import path from "path";
import { randomBytes } from "crypto";
import { getConfig } from "../config";
import type {
  DownloadJob,
  DownloadProgress,
  DownloadSource,
  SourceMetadata,
  CreateJobOptions,
} from "./types";
import { downloadFile, downloadToBuffer, HttpError } from "./downloader";
import {
  fetchCivArchiveMetadata,
  buildModelDict,
  buildImageSidecar,
  isCivArchiveUrl,
} from "./sources/civarchive";
import { fetchCivitaiMetadata, isCivitaiUrl } from "./sources/civitai";
import {
  fetchHuggingFaceMetadata,
  isHuggingFaceUrl,
} from "./sources/huggingface";
import { getToken } from "../tokens";

type ProgressCallback = (job: DownloadJob) => void;

interface ActiveDownload {
  job: DownloadJob;
  abortController: AbortController;
  listeners: Set<ProgressCallback>;
}

class JobManager {
  private jobs: Map<string, DownloadJob> = new Map();
  private activeDownloads: Map<string, ActiveDownload> = new Map();
  private persistPath: string;

  constructor() {
    this.persistPath = path.join(getConfig().dataDir, "downloads.json");
    this.loadJobs();
  }

  private loadJobs(): void {
    try {
      if (fs.existsSync(this.persistPath)) {
        const data = JSON.parse(fs.readFileSync(this.persistPath, "utf-8"));
        for (const job of data.jobs ?? []) {
          // Reset incomplete downloads to failed on restart
          if (job.status === "downloading" || job.status === "pending") {
            job.status = "failed";
            job.error = "Server restarted during download";
          }
          this.jobs.set(job.id, job);
        }
      }
    } catch {
      // Ignore errors loading jobs
    }
  }

  private saveJobs(): void {
    try {
      const config = getConfig();
      if (!fs.existsSync(config.dataDir)) {
        fs.mkdirSync(config.dataDir, { recursive: true });
      }
      const data = { jobs: Array.from(this.jobs.values()) };
      fs.writeFileSync(this.persistPath, JSON.stringify(data, null, 2));
    } catch {
      // Ignore errors saving jobs
    }
  }

  private updateJob(job: DownloadJob): void {
    job.updatedAt = new Date().toISOString();
    this.jobs.set(job.id, job);
    this.saveJobs();

    // Notify listeners
    const active = this.activeDownloads.get(job.id);
    if (active) {
      for (const listener of active.listeners) {
        listener(job);
      }
    }
  }

  detectSource(url: string): DownloadSource | null {
    if (isCivArchiveUrl(url)) return "civarchive";
    if (isCivitaiUrl(url)) return "civitai";
    if (isHuggingFaceUrl(url)) return "huggingface";
    return null;
  }

  async createJob(
    url: string,
    options: CreateJobOptions = {}
  ): Promise<DownloadJob> {
    const source = this.detectSource(url);
    if (!source) {
      throw new Error("Unsupported URL. Supported: civarchive, civitai, huggingface");
    }

    const id = randomBytes(8).toString("hex");
    const now = new Date().toISOString();

    const job: DownloadJob = {
      id,
      url,
      source,
      status: "pending",
      outputDir: options.outputDir,
      modelType: options.modelType,
      baseModel: options.baseModel,
      progress: {
        downloaded: 0,
        total: 0,
        speed: 0,
        percent: 0,
        eta: 0,
      },
      createdAt: now,
      updatedAt: now,
    };

    this.jobs.set(id, job);
    this.saveJobs();

    // Start download in background
    this.startDownload(job);

    return job;
  }

  private async startDownload(job: DownloadJob): Promise<void> {
    const abortController = new AbortController();
    const activeDownload: ActiveDownload = {
      job,
      abortController,
      listeners: new Set(),
    };
    this.activeDownloads.set(job.id, activeDownload);

    try {
      job.status = "downloading";
      this.updateJob(job);

      let metadata: SourceMetadata | null = null;

      // Skip metadata fetch if we already have it (retry case)
      const isRetry = job.downloadUrl && job.filePath && job.modelId;

      if (!isRetry) {
        // Fetch metadata
        if (job.source === "civarchive") {
          metadata = await fetchCivArchiveMetadata(job.url);
        } else if (job.source === "civitai") {
          const token = getToken("civitai");
          metadata = await fetchCivitaiMetadata(job.url, token);
        } else if (job.source === "huggingface") {
          const token = getToken("huggingface");
          metadata = await fetchHuggingFaceMetadata(job.url, token);
        } else {
          throw new Error(`Unsupported source: ${job.source}`);
        }

        job.modelName = metadata.modelName;
        job.modelId = metadata.modelId;
        job.versionId = metadata.versionId;
        job.versionName = metadata.versionName;
        this.updateJob(job);
      }

      let downloadUrl = job.downloadUrl;
      let destPath = job.filePath;
      let extraDataDir: string | undefined;
      let authHeaders: Record<string, string> = {};

      if (!isRetry && metadata) {
        // Find the primary file to download
        const file = metadata.files[0];
        if (!file) {
          throw new Error("No files available to download");
        }

        // Find a download URL
        if (file.downloadUrl) {
          downloadUrl = file.downloadUrl;
        } else if (file.mirrors) {
          const availableMirror = file.mirrors.find((m) => m.available);
          if (availableMirror) {
            downloadUrl = availableMirror.url;
          }
        }

        if (!downloadUrl) {
          throw new Error("No download URL available");
        }

        // Save download URL for resume/retry
        job.downloadUrl = downloadUrl;
        this.updateJob(job);

        // Determine output directory
        const TYPE_DIR_MAP: Record<string, string> = {
          LORA: "loras",
          Checkpoint: "diffusion_models",
          VAE: "vae",
          ControlNet: "controlnet",
          TextualInversion: "embeddings",
          Upscaler: "upscale_models",
        };

        const BASE_MODEL_DIR_MAP: Record<string, string> = {
          ZImageTurbo: "zit",
          Qwen: "qwen",
          "Qwen Image": "qwen",
          "Flux.2 Klein 9B": "qwen",
        };

        const modelDir = getConfig().modelDir;
        const modelNameClean = metadata.modelName.replace(/[<>:"/\\|?*]/g, "");

        // Use user overrides if provided, otherwise use detected values
        const effectiveModelType = job.modelType || metadata.modelType;
        const effectiveBaseModel = job.baseModel || metadata.baseModel;

        // Store effective values on job for display
        job.modelType = effectiveModelType;
        job.baseModel = effectiveBaseModel;

        let outputDir: string;

        if (job.outputDir && !job.modelType && !job.baseModel) {
          // User provided explicit output dir
          outputDir = path.join(path.resolve(job.outputDir), modelNameClean);
        } else {
          const typeDir = TYPE_DIR_MAP[effectiveModelType] ?? "other";
          const baseModelDir =
            BASE_MODEL_DIR_MAP[effectiveBaseModel ?? ""] ??
            effectiveBaseModel?.toLowerCase().replace(/[^a-z0-9]+/g, "_") ??
            "unknown";
          outputDir = path.join(modelDir, typeDir, baseModelDir, modelNameClean);
        }

        job.outputDir = outputDir;
        extraDataDir = path.join(
          outputDir,
          `extra_data-vid_${metadata.versionId}`
        );
        fs.mkdirSync(extraDataDir, { recursive: true });

        // Build filename
        const ext = path.extname(file.name);
        const baseName = file.name.replace(ext, "");
        const destFilename = `${baseName}-mid_${metadata.modelId}-vid_${metadata.versionId}${ext}`;
        destPath = path.join(outputDir, destFilename);

        job.fileName = destFilename;
        job.filePath = destPath;
        this.updateJob(job);
      } else {
        // Retry case - set up extraDataDir from existing job data
        if (job.outputDir && job.versionId) {
          extraDataDir = path.join(
            job.outputDir,
            `extra_data-vid_${job.versionId}`
          );
        }
      }

      if (!downloadUrl || !destPath) {
        throw new Error("Missing download URL or destination path");
      }

      // Add auth headers if needed
      if (downloadUrl.includes("huggingface.co")) {
        const hfToken = getToken("huggingface");
        if (hfToken) {
          authHeaders["Authorization"] = `Bearer ${hfToken}`;
        }
      } else if (downloadUrl.includes("civitai.com")) {
        const civitaiToken = getToken("civitai");
        if (civitaiToken) {
          authHeaders["Authorization"] = `Bearer ${civitaiToken}`;
        }
      }

      // Check if file is already complete
      const fileExists = fs.existsSync(destPath);
      const existingSize = fileExists ? fs.statSync(destPath).size : 0;
      const expectedSize = job.progress.total;

      // Only download if file doesn't exist or is incomplete
      if (!fileExists || (expectedSize > 0 && existingSize < expectedSize)) {
        await downloadFile(downloadUrl, destPath, {
          headers: authHeaders,
          signal: abortController.signal,
          onProgress: (progress: DownloadProgress) => {
            job.progress = progress;
            this.updateJob(job);
          },
        });
      }

      // Save model_dict JSON (only on first download, not retry)
      if (metadata && extraDataDir) {
        const modelDict = buildModelDict(metadata);
        const dictPath = path.join(
          extraDataDir,
          `model_dict-mid_${metadata.modelId}-vid_${metadata.versionId}.json`
        );
        fs.writeFileSync(dictPath, JSON.stringify(modelDict, null, 2));

        // Download images
        const images = metadata.images ?? [];
        for (const img of images) {
          try {
            const imgExt =
              path.extname(new URL(img.url).pathname) || ".jpeg";
            const imgFilename = `${img.id}${imgExt}`;
            const imgPath = path.join(extraDataDir, imgFilename);
            const sidecarPath = path.join(extraDataDir, `${img.id}.json`);

            // Save sidecar JSON
            fs.writeFileSync(
              sidecarPath,
              JSON.stringify(buildImageSidecar(img), null, 2)
            );

            // Download image if not exists
            if (!fs.existsSync(imgPath)) {
              const imgBuffer = await downloadToBuffer(img.url);
              fs.writeFileSync(imgPath, imgBuffer);
            }
          } catch {
            // Ignore image download errors
          }
        }
      }

      // Mark complete
      job.status = "completed";
      job.completedAt = new Date().toISOString();
      job.progress.percent = 100;
      this.updateJob(job);
    } catch (err) {
      if (abortController.signal.aborted) {
        job.status = "cancelled";
        job.error = "Download cancelled";
      } else {
        job.status = "failed";
        job.error = err instanceof Error ? err.message : String(err);
      }
      this.updateJob(job);
    } finally {
      this.activeDownloads.delete(job.id);
    }
  }

  getJob(id: string): DownloadJob | undefined {
    return this.jobs.get(id);
  }

  getAllJobs(): DownloadJob[] {
    return Array.from(this.jobs.values()).sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  }

  cancelJob(id: string): boolean {
    const active = this.activeDownloads.get(id);
    if (active) {
      active.abortController.abort();
      return true;
    }
    return false;
  }

  subscribe(id: string, callback: ProgressCallback): () => void {
    const active = this.activeDownloads.get(id);
    if (active) {
      active.listeners.add(callback);
      return () => active.listeners.delete(callback);
    }
    return () => {};
  }

  isActive(id: string): boolean {
    return this.activeDownloads.has(id);
  }

  clearCompleted(): void {
    for (const [id, job] of this.jobs) {
      if (
        job.status === "completed" ||
        job.status === "failed" ||
        job.status === "cancelled"
      ) {
        this.jobs.delete(id);
      }
    }
    this.saveJobs();
  }

  async retryJob(id: string): Promise<DownloadJob | null> {
    const job = this.jobs.get(id);
    if (!job) return null;

    // Only retry failed or cancelled jobs
    if (job.status !== "failed" && job.status !== "cancelled") {
      return null;
    }

    // Check if already active
    if (this.activeDownloads.has(id)) {
      return null;
    }

    // Reset job state for retry
    job.status = "pending";
    job.error = undefined;
    job.retryCount = (job.retryCount ?? 0) + 1;
    job.updatedAt = new Date().toISOString();

    // Keep progress if we have a partial file
    if (job.filePath && fs.existsSync(job.filePath)) {
      const stats = fs.statSync(job.filePath);
      job.progress.downloaded = stats.size;
    }

    this.updateJob(job);
    this.startDownload(job);

    return job;
  }
}

// Singleton instance
let _jobManager: JobManager | null = null;

export function getJobManager(): JobManager {
  if (!_jobManager) {
    _jobManager = new JobManager();
  }
  return _jobManager;
}

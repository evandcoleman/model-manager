"use client";

import { useState, useEffect } from "react";
import { X, Plus, Trash2, Upload, Loader2 } from "lucide-react";

const SAMPLER_OPTIONS = [
  "Euler",
  "Euler a",
  "Heun",
  "DPM++ 2M",
  "DPM++ 2M Karras",
  "DPM++ 2M SDE",
  "DPM++ 2M SDE Karras",
  "DPM++ SDE",
  "DPM++ SDE Karras",
  "DDIM",
  "UniPC",
  "LCM",
];

const SCHEDULER_OPTIONS = [
  "Normal",
  "Karras",
  "Exponential",
  "SGM Uniform",
  "Simple",
  "DDIM Uniform",
];

const NSFW_LEVELS = [
  { value: 0, label: "Safe" },
  { value: 1, label: "Soft" },
  { value: 2, label: "Mature" },
  { value: 3, label: "X" },
];

interface LoraEntry {
  name: string;
  strength: number;
}

interface VersionOption {
  id: number;
  name: string;
}

interface UploadDialogProps {
  file: File;
  modelId: number;
  versions?: VersionOption[];
  selectedVersionId?: number | null;
  onClose: () => void;
  onSuccess: () => void;
}

export function UploadDialog({ file, modelId, versions, selectedVersionId, onClose, onSuccess }: UploadDialogProps) {
  const [preview, setPreview] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form fields
  const [prompt, setPrompt] = useState("");
  const [negativePrompt, setNegativePrompt] = useState("");
  const [seed, setSeed] = useState("");
  const [steps, setSteps] = useState("");
  const [cfgScale, setCfgScale] = useState("");
  const [sampler, setSampler] = useState("");
  const [scheduler, setScheduler] = useState("");
  const [nsfwLevel, setNsfwLevel] = useState(0);
  const [loras, setLoras] = useState<LoraEntry[]>([]);
  const [workflowJson, setWorkflowJson] = useState("");
  const [uploadTarget, setUploadTarget] = useState<string>(
    selectedVersionId != null ? String(selectedVersionId) : "model"
  );

  // Generate preview URL
  useEffect(() => {
    const url = URL.createObjectURL(file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  // Prevent body scroll
  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "";
    };
  }, []);

  const addLora = () => {
    setLoras([...loras, { name: "", strength: 1.0 }]);
  };

  const updateLora = (index: number, field: keyof LoraEntry, value: string | number) => {
    const updated = [...loras];
    updated[index] = { ...updated[index], [field]: value };
    setLoras(updated);
  };

  const removeLora = (index: number) => {
    setLoras(loras.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setUploading(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append("file", file);

      if (prompt) formData.append("prompt", prompt);
      if (negativePrompt) formData.append("negativePrompt", negativePrompt);
      if (seed) formData.append("seed", seed);
      if (steps) formData.append("steps", steps);
      if (cfgScale) formData.append("cfgScale", cfgScale);
      if (sampler) formData.append("sampler", sampler);
      if (scheduler) formData.append("scheduler", scheduler);
      formData.append("nsfwLevel", String(nsfwLevel));

      if (loras.length > 0) {
        const validLoras = loras.filter((l) => l.name.trim());
        if (validLoras.length > 0) {
          formData.append("loras", JSON.stringify(validLoras));
        }
      }

      // Add versionId if uploading to a specific version
      if (uploadTarget !== "model") {
        formData.append("versionId", uploadTarget);
      }

      if (workflowJson.trim()) {
        try {
          JSON.parse(workflowJson);
          formData.append("comfyWorkflow", workflowJson);
        } catch {
          throw new Error("Invalid workflow JSON");
        }
      }

      const res = await fetch(`/api/models/${modelId}/images`, {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Upload failed");
      }

      onSuccess();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 p-4">
      <div className="relative flex max-h-[90vh] w-full max-w-4xl flex-col rounded-2xl bg-background border border-border shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border px-6 py-4">
          <h2 className="text-lg font-semibold">Upload Image</h2>
          <button
            onClick={onClose}
            className="rounded-lg p-2 text-muted hover:text-foreground hover:bg-card transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content */}
        <form onSubmit={handleSubmit} className="flex flex-1 overflow-hidden">
          {/* Left: Image preview */}
          <div className="w-1/3 flex-shrink-0 border-r border-border p-4 flex items-center justify-center bg-zinc-950">
            {preview && (
              <img
                src={preview}
                alt="Preview"
                className="max-h-full max-w-full object-contain rounded-lg"
              />
            )}
          </div>

          {/* Right: Form fields */}
          <div className="flex-1 overflow-y-auto p-6 space-y-5">
            {/* Upload Target */}
            {versions && versions.length > 0 && (
              <div>
                <label className="block text-sm font-medium text-muted mb-1.5">
                  Upload To
                </label>
                <select
                  value={uploadTarget}
                  onChange={(e) => setUploadTarget(e.target.value)}
                  className="w-full rounded-lg border border-border bg-card px-3 py-2 text-sm focus:border-accent focus:outline-none"
                >
                  <option value="model">All Versions (Model-level)</option>
                  {versions.map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.name} only
                    </option>
                  ))}
                </select>
                <p className="mt-1 text-xs text-muted">
                  {uploadTarget === "model"
                    ? "Image will appear on all versions"
                    : "Image will only appear on the selected version"}
                </p>
              </div>
            )}

            {/* Prompt */}
            <div>
              <label className="block text-sm font-medium text-muted mb-1.5">
                Prompt
              </label>
              <textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                rows={3}
                className="w-full rounded-lg border border-border bg-card px-3 py-2 text-sm focus:border-accent focus:outline-none resize-y"
                placeholder="The prompt used to generate this image..."
              />
            </div>

            {/* Negative Prompt */}
            <div>
              <label className="block text-sm font-medium text-muted mb-1.5">
                Negative Prompt
              </label>
              <textarea
                value={negativePrompt}
                onChange={(e) => setNegativePrompt(e.target.value)}
                rows={2}
                className="w-full rounded-lg border border-border bg-card px-3 py-2 text-sm focus:border-accent focus:outline-none resize-y"
                placeholder="Negative prompt..."
              />
            </div>

            {/* Grid of number inputs */}
            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-muted mb-1.5">
                  Seed
                </label>
                <input
                  type="number"
                  value={seed}
                  onChange={(e) => setSeed(e.target.value)}
                  className="w-full rounded-lg border border-border bg-card px-3 py-2 text-sm focus:border-accent focus:outline-none"
                  placeholder="-1"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-muted mb-1.5">
                  Steps
                </label>
                <input
                  type="number"
                  value={steps}
                  onChange={(e) => setSteps(e.target.value)}
                  className="w-full rounded-lg border border-border bg-card px-3 py-2 text-sm focus:border-accent focus:outline-none"
                  placeholder="20"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-muted mb-1.5">
                  CFG Scale
                </label>
                <input
                  type="number"
                  step="0.1"
                  value={cfgScale}
                  onChange={(e) => setCfgScale(e.target.value)}
                  className="w-full rounded-lg border border-border bg-card px-3 py-2 text-sm focus:border-accent focus:outline-none"
                  placeholder="7"
                />
              </div>
            </div>

            {/* Dropdowns */}
            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-muted mb-1.5">
                  Sampler
                </label>
                <select
                  value={sampler}
                  onChange={(e) => setSampler(e.target.value)}
                  className="w-full rounded-lg border border-border bg-card px-3 py-2 text-sm focus:border-accent focus:outline-none"
                >
                  <option value="">Select...</option>
                  {SAMPLER_OPTIONS.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-muted mb-1.5">
                  Scheduler
                </label>
                <select
                  value={scheduler}
                  onChange={(e) => setScheduler(e.target.value)}
                  className="w-full rounded-lg border border-border bg-card px-3 py-2 text-sm focus:border-accent focus:outline-none"
                >
                  <option value="">Select...</option>
                  {SCHEDULER_OPTIONS.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-muted mb-1.5">
                  NSFW Level
                </label>
                <select
                  value={nsfwLevel}
                  onChange={(e) => setNsfwLevel(parseInt(e.target.value))}
                  className="w-full rounded-lg border border-border bg-card px-3 py-2 text-sm focus:border-accent focus:outline-none"
                >
                  {NSFW_LEVELS.map((l) => (
                    <option key={l.value} value={l.value}>
                      {l.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* LoRAs */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-sm font-medium text-muted">LoRAs</label>
                <button
                  type="button"
                  onClick={addLora}
                  className="flex items-center gap-1 text-xs text-accent hover:text-accent/80"
                >
                  <Plus className="h-3 w-3" />
                  Add LoRA
                </button>
              </div>
              {loras.length > 0 && (
                <div className="space-y-2">
                  {loras.map((lora, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <input
                        type="text"
                        value={lora.name}
                        onChange={(e) => updateLora(i, "name", e.target.value)}
                        placeholder="LoRA name"
                        className="flex-1 rounded-lg border border-border bg-card px-3 py-2 text-sm focus:border-accent focus:outline-none"
                      />
                      <input
                        type="number"
                        step="0.1"
                        value={lora.strength}
                        onChange={(e) =>
                          updateLora(i, "strength", parseFloat(e.target.value) || 0)
                        }
                        className="w-20 rounded-lg border border-border bg-card px-3 py-2 text-sm focus:border-accent focus:outline-none"
                      />
                      <button
                        type="button"
                        onClick={() => removeLora(i)}
                        className="p-2 text-muted hover:text-red-500 transition-colors"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* ComfyUI Workflow */}
            <div>
              <label className="block text-sm font-medium text-muted mb-1.5">
                ComfyUI Workflow (JSON)
              </label>
              <textarea
                value={workflowJson}
                onChange={(e) => setWorkflowJson(e.target.value)}
                rows={4}
                className="w-full rounded-lg border border-border bg-card px-3 py-2 text-sm font-mono focus:border-accent focus:outline-none resize-y"
                placeholder='{"nodes": [...], "links": [...]}'
              />
            </div>

            {error && (
              <div className="text-sm text-red-500 bg-red-500/10 rounded-lg px-3 py-2">
                {error}
              </div>
            )}
          </div>
        </form>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 border-t border-border px-6 py-4">
          <button
            type="button"
            onClick={onClose}
            disabled={uploading}
            className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-muted hover:text-foreground transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={uploading}
            className="flex items-center gap-2 rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent/90 transition-colors disabled:opacity-50"
          >
            {uploading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Uploading...
              </>
            ) : (
              <>
                <Upload className="h-4 w-4" />
                Upload
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

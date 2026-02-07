"use client";

import { useState, useEffect } from "react";
import { Eye, EyeOff, Check, X } from "lucide-react";
import { apiFetch } from "@/lib/api-client";

type TokenService = "civitai" | "huggingface";

interface TokenFieldProps {
  service: TokenService;
  label: string;
  placeholder: string;
  description: string;
  maskedValue: string | null;
  onSave: (service: TokenService, token: string) => Promise<void>;
  onDelete: (service: TokenService) => Promise<void>;
}

function TokenField({
  service,
  label,
  placeholder,
  description,
  maskedValue,
  onSave,
  onDelete,
}: TokenFieldProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [value, setValue] = useState("");
  const [showValue, setShowValue] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const hasToken = !!maskedValue;

  async function handleSave() {
    if (!value.trim()) return;
    setIsSaving(true);
    try {
      await onSave(service, value.trim());
      setIsEditing(false);
      setValue("");
    } finally {
      setIsSaving(false);
    }
  }

  async function handleDelete() {
    setIsDeleting(true);
    try {
      await onDelete(service);
    } finally {
      setIsDeleting(false);
    }
  }

  function handleCancel() {
    setIsEditing(false);
    setValue("");
    setShowValue(false);
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <label className="text-sm font-medium text-foreground/80">
          {label}
        </label>
        {hasToken && !isEditing && (
          <button
            onClick={handleDelete}
            disabled={isDeleting}
            className="text-xs text-red-400 hover:text-red-300 transition-colors"
          >
            {isDeleting ? "Removing..." : "Remove"}
          </button>
        )}
      </div>
      <p className="text-xs text-muted">{description}</p>

      {isEditing ? (
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <input
              type={showValue ? "text" : "password"}
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder={placeholder}
              className="h-10 w-full rounded-lg border border-border bg-background px-3 pr-10 text-sm text-foreground outline-none focus:border-accent transition-colors"
              autoFocus
            />
            <button
              type="button"
              onClick={() => setShowValue(!showValue)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted hover:text-foreground transition-colors"
            >
              {showValue ? (
                <EyeOff className="h-4 w-4" />
              ) : (
                <Eye className="h-4 w-4" />
              )}
            </button>
          </div>
          <button
            onClick={handleSave}
            disabled={!value.trim() || isSaving}
            className="h-10 w-10 flex items-center justify-center rounded-lg bg-accent text-white hover:bg-accent/90 disabled:opacity-50 transition-colors"
          >
            <Check className="h-4 w-4" />
          </button>
          <button
            onClick={handleCancel}
            className="h-10 w-10 flex items-center justify-center rounded-lg border border-border bg-background text-muted hover:text-foreground transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      ) : hasToken ? (
        <div className="flex items-center gap-2">
          <div className="flex-1 h-10 rounded-lg border border-border bg-background px-3 flex items-center">
            <code className="text-sm font-mono text-foreground/70">
              {maskedValue}
            </code>
          </div>
          <button
            onClick={() => setIsEditing(true)}
            className="h-10 px-4 rounded-lg border border-border bg-background text-sm text-foreground/80 hover:bg-card-hover transition-colors"
          >
            Update
          </button>
        </div>
      ) : (
        <button
          onClick={() => setIsEditing(true)}
          className="h-10 rounded-lg border border-dashed border-border px-4 text-sm text-muted hover:text-foreground hover:border-accent/50 transition-colors"
        >
          + Add Token
        </button>
      )}
    </div>
  );
}

export function TokenSettings() {
  const [tokens, setTokens] = useState<Record<string, string | null>>({
    civitai: null,
    huggingface: null,
  });

  useEffect(() => {
    fetchTokens();
  }, []);

  async function fetchTokens() {
    const res = await apiFetch("/api/v1/settings/tokens");
    if (res.ok) {
      const data = await res.json();
      setTokens(data);
    }
  }

  async function handleSave(service: TokenService, token: string) {
    const res = await apiFetch("/api/v1/settings/tokens", {
      method: "PUT",
      body: JSON.stringify({ service, token }),
    });
    if (res.ok) {
      const data = await res.json();
      setTokens((prev) => ({ ...prev, [service]: data.masked }));
    }
  }

  async function handleDelete(service: TokenService) {
    const res = await apiFetch(`/api/v1/settings/tokens/${service}`, {
      method: "DELETE",
    });
    if (res.ok) {
      setTokens((prev) => ({ ...prev, [service]: null }));
    }
  }

  return (
    <section className="rounded-xl border border-border bg-card p-6">
      <h2 className="text-lg font-medium mb-4">API Tokens</h2>
      <p className="text-sm text-muted mb-6">
        Add API tokens to download models from authenticated sources.
      </p>

      <div className="space-y-6">
        <TokenField
          service="civitai"
          label="CivitAI"
          placeholder="Enter your CivitAI API token"
          description="Required to download some models directly from CivitAI. Get your token from civitai.com/user/account."
          maskedValue={tokens.civitai}
          onSave={handleSave}
          onDelete={handleDelete}
        />

        <TokenField
          service="huggingface"
          label="HuggingFace"
          placeholder="hf_..."
          description="Required to download gated models from HuggingFace. Get your token from huggingface.co/settings/tokens."
          maskedValue={tokens.huggingface}
          onSave={handleSave}
          onDelete={handleDelete}
        />
      </div>
    </section>
  );
}

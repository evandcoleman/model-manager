"use client";

import { useState, useEffect, FormEvent } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Eye, EyeOff, Copy, RefreshCw, Check } from "lucide-react";
import Link from "next/link";
import { TokenSettings } from "@/components/settings/token-settings";
import { clearApiKeyCache } from "@/lib/api-client";

export default function AccountPage() {
  const router = useRouter();

  // Password change state
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [passwordSuccess, setPasswordSuccess] = useState(false);
  const [isChangingPassword, setIsChangingPassword] = useState(false);

  // API key state
  const [apiKey, setApiKey] = useState("");
  const [maskedApiKey, setMaskedApiKey] = useState("");
  const [showApiKey, setShowApiKey] = useState(false);
  const [copied, setCopied] = useState(false);
  const [isRegenerating, setIsRegenerating] = useState(false);
  const [showRegenerateConfirm, setShowRegenerateConfirm] = useState(false);

  useEffect(() => {
    fetchApiKey();
  }, []);

  async function fetchApiKey() {
    const res = await fetch("/api/auth/api-key");
    if (res.ok) {
      const data = await res.json();
      setApiKey(data.key);
      setMaskedApiKey(data.maskedKey);
    }
  }

  async function handlePasswordChange(e: FormEvent) {
    e.preventDefault();
    setPasswordError("");
    setPasswordSuccess(false);

    if (newPassword !== confirmPassword) {
      setPasswordError("Passwords do not match");
      return;
    }

    if (newPassword.length < 8) {
      setPasswordError("Password must be at least 8 characters");
      return;
    }

    setIsChangingPassword(true);

    try {
      const res = await fetch("/api/auth/password", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword, newPassword }),
      });

      if (res.ok) {
        setPasswordSuccess(true);
        setTimeout(() => {
          router.push("/login");
        }, 1500);
      } else {
        const data = await res.json();
        setPasswordError(data.error || "Failed to change password");
      }
    } catch {
      setPasswordError("An error occurred");
    } finally {
      setIsChangingPassword(false);
    }
  }

  async function handleRegenerateApiKey() {
    setIsRegenerating(true);
    try {
      const res = await fetch("/api/auth/api-key", { method: "POST" });
      if (res.ok) {
        const data = await res.json();
        setApiKey(data.key);
        setMaskedApiKey(data.maskedKey);
        setShowApiKey(true);
      }
    } finally {
      setIsRegenerating(false);
      setShowRegenerateConfirm(false);
    }
  }

  function handleCopy() {
    navigator.clipboard.writeText(apiKey);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  async function handleLogout() {
    clearApiKeyCache();
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border/50 bg-background/80 backdrop-blur-xl">
        <div className="mx-auto flex h-14 max-w-2xl items-center gap-4 px-4">
          <Link
            href="/"
            className="flex items-center gap-2 text-sm text-muted hover:text-foreground transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            Back
          </Link>
          <h1 className="text-lg font-semibold tracking-tight">
            Account Settings
          </h1>
        </div>
      </header>

      <main className="mx-auto max-w-2xl px-4 py-8 space-y-8">
        {/* Change Password Section */}
        <section className="rounded-xl border border-border bg-card p-6">
          <h2 className="text-lg font-medium mb-4">Change Password</h2>

          <form onSubmit={handlePasswordChange} className="space-y-4">
            {passwordError && (
              <div className="rounded-lg bg-red-500/10 border border-red-500/30 px-4 py-3 text-sm text-red-400">
                {passwordError}
              </div>
            )}

            {passwordSuccess && (
              <div className="rounded-lg bg-green-500/10 border border-green-500/30 px-4 py-3 text-sm text-green-400">
                Password changed. Redirecting to login...
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-foreground/80 mb-1.5">
                Current Password
              </label>
              <input
                type="password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                className="h-10 w-full rounded-lg border border-border bg-background px-3 text-sm text-foreground outline-none focus:border-accent transition-colors"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-foreground/80 mb-1.5">
                New Password
              </label>
              <input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="h-10 w-full rounded-lg border border-border bg-background px-3 text-sm text-foreground outline-none focus:border-accent transition-colors"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-foreground/80 mb-1.5">
                Confirm New Password
              </label>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="h-10 w-full rounded-lg border border-border bg-background px-3 text-sm text-foreground outline-none focus:border-accent transition-colors"
                required
              />
            </div>

            <button
              type="submit"
              disabled={isChangingPassword}
              className="h-10 rounded-lg bg-accent px-4 text-white text-sm font-medium hover:bg-accent/90 disabled:opacity-50 transition-colors"
            >
              {isChangingPassword ? "Changing..." : "Change Password"}
            </button>
          </form>
        </section>

        {/* API Tokens Section */}
        <TokenSettings />

        {/* API Key Section */}
        <section className="rounded-xl border border-border bg-card p-6">
          <h2 className="text-lg font-medium mb-4">API Key</h2>
          <p className="text-sm text-muted mb-4">
            Use this key to authenticate REST API requests with the
            Authorization header: <code className="text-xs bg-background px-1.5 py-0.5 rounded">Bearer YOUR_KEY</code>
          </p>

          <div className="flex items-center gap-2 mb-4">
            <div className="flex-1 h-10 rounded-lg border border-border bg-background px-3 flex items-center">
              <code className="text-sm font-mono text-foreground/90">
                {showApiKey ? apiKey : maskedApiKey}
              </code>
            </div>

            <button
              onClick={() => setShowApiKey(!showApiKey)}
              className="h-10 w-10 flex items-center justify-center rounded-lg border border-border bg-background text-muted hover:text-foreground transition-colors"
              title={showApiKey ? "Hide" : "Show"}
            >
              {showApiKey ? (
                <EyeOff className="h-4 w-4" />
              ) : (
                <Eye className="h-4 w-4" />
              )}
            </button>

            <button
              onClick={handleCopy}
              className="h-10 w-10 flex items-center justify-center rounded-lg border border-border bg-background text-muted hover:text-foreground transition-colors"
              title="Copy"
            >
              {copied ? (
                <Check className="h-4 w-4 text-green-400" />
              ) : (
                <Copy className="h-4 w-4" />
              )}
            </button>
          </div>

          {showRegenerateConfirm ? (
            <div className="rounded-lg bg-yellow-500/10 border border-yellow-500/30 p-4">
              <p className="text-sm text-yellow-400 mb-3">
                Are you sure? This will invalidate the current API key.
              </p>
              <div className="flex gap-2">
                <button
                  onClick={handleRegenerateApiKey}
                  disabled={isRegenerating}
                  className="h-9 rounded-lg bg-yellow-600 px-3 text-white text-sm font-medium hover:bg-yellow-500 disabled:opacity-50 transition-colors"
                >
                  {isRegenerating ? "Regenerating..." : "Yes, Regenerate"}
                </button>
                <button
                  onClick={() => setShowRegenerateConfirm(false)}
                  className="h-9 rounded-lg border border-border px-3 text-sm text-foreground/80 hover:bg-card-hover transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => setShowRegenerateConfirm(true)}
              className="flex items-center gap-2 h-9 rounded-lg border border-border px-3 text-sm text-foreground/80 hover:bg-card-hover transition-colors"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              Regenerate Key
            </button>
          )}
        </section>

        {/* Sign Out Section */}
        <section className="rounded-xl border border-border bg-card p-6">
          <h2 className="text-lg font-medium mb-4">Session</h2>
          <button
            onClick={handleLogout}
            className="h-10 rounded-lg border border-red-500/50 px-4 text-red-400 text-sm font-medium hover:bg-red-500/10 transition-colors"
          >
            Sign Out
          </button>
        </section>
      </main>
    </div>
  );
}

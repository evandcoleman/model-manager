import DOMPurify from "isomorphic-dompurify";

export function formatFileSize(bytes: number | null | undefined): string {
  if (bytes == null || bytes === 0) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / Math.pow(1024, i)).toFixed(i > 0 ? 1 : 0)} ${units[i]}`;
}

export function formatNumber(n: number | null | undefined): string {
  if (n == null) return "0";
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toString();
}

export function cn(...classes: (string | undefined | null | false)[]): string {
  return classes.filter(Boolean).join(" ");
}

const NSFW_LABELS: Record<number, string> = {
  0: "Safe",
  1: "Safe",
  2: "Suggestive",
  4: "Suggestive+",
  8: "Mature",
  16: "Explicit",
  32: "Extreme",
};

export function getNsfwLabel(level: number): string {
  // nsfwLevel is a bitmask — find the highest set bit
  if (level === 0) return "Safe";
  let highest = 0;
  let val = level;
  while (val > 0) {
    highest = val & -val;
    val &= val - 1;
  }
  return NSFW_LABELS[highest] ?? `NSFW (${level})`;
}

export function sanitizeHtml(html: string): string {
  if (typeof window === "undefined") return html;
  return DOMPurify.sanitize(html, {
    ALLOWED_TAGS: [
      "p", "br", "strong", "b", "em", "i", "u", "a", "ul", "ol", "li",
      "h1", "h2", "h3", "h4", "h5", "h6", "blockquote", "code", "pre"
    ],
    ALLOWED_ATTR: ["href", "target", "rel"],
  });
}

export function formatSizeKb(sizeKb: number | null | undefined): string {
  if (sizeKb == null) return "—";
  return formatFileSize(sizeKb * 1024);
}

/**
 * Get the URL for an image.
 * - User uploads (isUserUpload=true): Use ID-based routes for security
 * - Scanner images (isUserUpload=false): Use path-based routes with thumbPath/localPath
 */
export function getImageUrl(
  image: {
    id: number;
    localPath?: string | null;
    thumbPath?: string | null;
    isUserUpload?: boolean;
  },
  variant: "full" | "thumb" = "full"
): string | null {
  if (image.isUserUpload) {
    // User uploads use ID-based routes (paths not exposed in API)
    return variant === "thumb"
      ? `/api/images/upload/${image.id}/thumb`
      : `/api/images/upload/${image.id}`;
  }

  // Scanner images use path-based routes
  const path = variant === "thumb" ? (image.thumbPath ?? image.localPath) : image.localPath;
  if (!path) return null;

  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  return `/api/images${normalizedPath}`;
}

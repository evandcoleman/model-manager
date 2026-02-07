/**
 * API client for making authenticated requests to v1 endpoints.
 * Fetches the API key from the session endpoint and caches it.
 */

let cachedApiKey: string | null = null;

async function getApiKey(): Promise<string> {
  if (cachedApiKey) {
    return cachedApiKey;
  }

  const res = await fetch("/api/auth/api-key");
  if (!res.ok) {
    throw new Error("Failed to get API key - not authenticated");
  }

  const data = await res.json();
  cachedApiKey = data.key;
  return cachedApiKey!;
}

export function clearApiKeyCache(): void {
  cachedApiKey = null;
}

export interface ApiRequestOptions extends Omit<RequestInit, "headers"> {
  headers?: Record<string, string>;
}

const isDesktop = process.env.NEXT_PUBLIC_DESKTOP_MODE === "true";

export async function apiFetch(
  path: string,
  options: ApiRequestOptions = {}
): Promise<Response> {
  const headers: Record<string, string> = {
    ...options.headers,
  };

  if (!isDesktop) {
    const apiKey = await getApiKey();
    headers["Authorization"] = `Bearer ${apiKey}`;
  }

  // Add Content-Type for JSON bodies
  if (options.body && typeof options.body === "string") {
    headers["Content-Type"] = headers["Content-Type"] ?? "application/json";
  }

  return fetch(path, {
    ...options,
    headers,
  });
}

/**
 * Create an EventSource with API key authentication.
 * Note: EventSource doesn't support custom headers natively,
 * so we pass the key as a query parameter for SSE endpoints.
 */
export async function createAuthenticatedEventSource(
  path: string
): Promise<EventSource> {
  const url = new URL(path, window.location.origin);
  if (!isDesktop) {
    const apiKey = await getApiKey();
    url.searchParams.set("key", apiKey);
  }
  return new EventSource(url.toString());
}

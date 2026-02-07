/**
 * Client-side check: true when running inside Electron's BrowserWindow.
 * Safe to use in "use client" components.
 */
export const isDesktop =
  typeof window !== "undefined" &&
  !!(window as { electronAPI?: unknown }).electronAPI;

/**
 * Server/build-time check: true when the DESKTOP_MODE env flag is set.
 * Works in both server components and during build.
 */
export const isDesktopMode = process.env.NEXT_PUBLIC_DESKTOP_MODE === "true";

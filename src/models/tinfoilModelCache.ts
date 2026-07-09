import type { CloudModelDefinition } from "./ModelRegistry";

const CACHE_KEY = "tinfoilModels";

/**
 * The last list Tinfoil gave us. Persisting it means a launch that hasn't
 * refreshed yet still knows every model the user has seen, rather than falling
 * back to whatever happened to be bundled at build time.
 */
export function readCachedTinfoilModels(): CloudModelDefinition[] {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function writeCachedTinfoilModels(models: CloudModelDefinition[]): void {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(models));
  } catch {
    // Cache is best-effort; a failed write just means a refetch next launch.
  }
}

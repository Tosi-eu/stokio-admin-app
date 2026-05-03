export const STORAGE_KEY_API = "admin_stock_api_key";
export const THEME_KEY = "admin_stockio_theme";
export const DEFAULT_API_BASE = "http://localhost/api/v1";

export function readInitialApiBase(): string {
  const fromEnv = import.meta.env.VITE_API_BASE?.trim();
  if (fromEnv) return fromEnv;
  return DEFAULT_API_BASE;
}

export function readInitialApiKey(): string {
  if (typeof window !== "undefined") {
    const stored = localStorage.getItem(STORAGE_KEY_API);
    if (stored != null && stored !== "") return stored;
  }
  return import.meta.env.VITE_X_API_KEY?.trim() ?? "";
}

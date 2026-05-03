export type AdminTenant = {
  id: number;
  slug: string;
  name: string;
  contractPortfolioId?: number | null;
  contractConfigured?: boolean;
  contractBoundLogin?: string | null;
};

export type TenantsResponse = {
  data: AdminTenant[];
  total: number;
  page: number;
  limit: number;
};

export function normalizeBase(url: string): string {
  return url.replace(/\/+$/, "");
}

export async function adminFetch(
  base: string,
  path: string,
  apiKey: string,
  init?: RequestInit,
): Promise<Response> {
  if (window.adminStock?.request) {
    const method = String(init?.method ?? "GET").toUpperCase();
    const body =
      init?.body && typeof init.body === "string"
        ? JSON.parse(init.body)
        : undefined;
    const out = await window.adminStock.request({
      path,
      method,
      apiKey,
      ...(body !== undefined ? { body } : {}),
    });
    return new Response(out.text, {
      status: out.status,
      statusText: out.statusText,
      headers: { "Content-Type": "application/json; charset=utf-8" },
    });
  }

  const url = `${normalizeBase(base)}${path.startsWith("/") ? path : `/${path}`}`;
  const headers = new Headers(init?.headers);
  headers.set("X-API-Key", apiKey.trim());
  if (
    init?.body &&
    !(init.body instanceof FormData) &&
    !headers.has("Content-Type")
  ) {
    headers.set("Content-Type", "application/json");
  }
  return fetch(url, { ...init, headers });
}

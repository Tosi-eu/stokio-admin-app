/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_BASE?: string;
  readonly VITE_X_API_KEY?: string;
  /** Base URL da UI Temporal (ex.: http://localhost:8080) — usado para links a workflows. */
  readonly VITE_TEMPORAL_WEB_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

declare global {
  interface Window {
    adminStock?: {
      request: (args: {
        path: string;
        method?: string;
        apiKey: string;
        body?: unknown;
      }) => Promise<{
        ok: boolean;
        status: number;
        statusText: string;
        text: string;
      }>;
      upload: (args: {
        path: string;
        apiKey: string;
        filename: string;
        contentType?: string;
        fieldName?: string;
        bytes: number[] | Uint8Array;
      }) => Promise<{
        ok: boolean;
        status: number;
        statusText: string;
        text: string;
      }>;
    };
  }
}

export {};

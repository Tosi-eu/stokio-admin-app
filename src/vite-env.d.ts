/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_BASE?: string;
  readonly VITE_X_API_KEY?: string;
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
    };
  }
}

export {};

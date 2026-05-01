import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import { toast } from "sonner";
import { RefreshCw } from "lucide-react";

import { AppToaster } from "@/components/toast";
import { LogoMark } from "@/components/logo";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const STORAGE_KEY = "admin_stock_api_key";
const THEME_KEY = "admin_stockio_theme";

const DEFAULT_API_BASE = "http://localhost/api/v1";

function readInitialApiBase(): string {
  const fromEnv = import.meta.env.VITE_API_BASE?.trim();
  if (fromEnv) return fromEnv;
  return DEFAULT_API_BASE;
}

function readInitialApiKey(): string {
  if (typeof window !== "undefined") {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored != null && stored !== "") return stored;
  }
  return import.meta.env.VITE_X_API_KEY?.trim() ?? "";
}

function normalizeBase(url: string): string {
  return url.replace(/\/+$/, "");
}

async function adminFetch(
  base: string,
  path: string,
  apiKey: string,
  init?: RequestInit,
): Promise<Response> {
  // No Electron renderer, requests with custom headers trigger CORS preflight and the backend
  // intentionally blocks API key usage when Origin is present. So we proxy requests via
  // Electron main process (no Origin header).
  if (window.adminStock?.request) {
    const method = String(init?.method ?? "GET").toUpperCase();
    const body =
      init?.body && typeof init.body === "string" ? JSON.parse(init.body) : undefined;
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

type AdminTenant = {
  id: number;
  slug: string;
  name: string;
  contractPortfolioId?: number | null;
  contractConfigured?: boolean;
  contractBoundLogin?: string | null;
};

type TenantsResponse = {
  data: AdminTenant[];
  total: number;
  page: number;
  limit: number;
};

export function App() {
  const apiBase = useMemo(() => readInitialApiBase(), []);
  const [apiKey, setApiKey] = useState(readInitialApiKey);

  const [authenticated, setAuthenticated] = useState(false);
  const [loading, setLoading] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  const [tenants, setTenants] = useState<AdminTenant[]>([]);

  const [createSlug, setCreateSlug] = useState("");
  const [createName, setCreateName] = useState("");
  const [createContract, setCreateContract] = useState("");

  const [theme, setTheme] = useState(() => {
    if (typeof window === "undefined") return "abrigo";
    const stored = localStorage.getItem(THEME_KEY);
    return stored && stored.trim() ? stored : "abrigo";
  });

  const [selectedSlug, setSelectedSlug] = useState("");
  const [newContractCode, setNewContractCode] = useState("");
  const [boundLogin, setBoundLogin] = useState("");
  const [xlsxFile, setXlsxFile] = useState<File | null>(null);
  const [dumpFile, setDumpFile] = useState<File | null>(null);
  const [birthDateFallback, setBirthDateFallback] = useState("");

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, apiKey);
  }, [apiKey]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    localStorage.setItem(THEME_KEY, theme);
    document.documentElement.dataset.theme = theme;
  }, [theme]);

  const canTryLogin = useMemo(
    () => apiKey.trim().length > 0 && normalizeBase(apiBase).length > 0,
    [apiKey, apiBase],
  );

  const selectedTenant = useMemo(
    () => tenants.find((t) => t.slug === selectedSlug) ?? null,
    [tenants, selectedSlug],
  );

  const connect = useCallback(async () => {
    setAuthError(null);
    if (!canTryLogin) {
      setAuthError("Informe a chave.");
      return;
    }
    setLoading(true);
    try {
      const res = await adminFetch(
        apiBase,
        "/admin/tenants?page=1&limit=200",
        apiKey,
      );
      if (!res.ok) {
        setAuthenticated(false);
        setTenants([]);
        let msg = "Chave inválida ou sem permissão.";
        try {
          const j = (await res.json()) as { error?: string };
          if (j?.error) msg = String(j.error);
        } catch {
          // ignore
        }
        setAuthError(msg);
        toast.error("Acesso negado", { description: msg });
        return;
      }
      const body = (await res.json()) as TenantsResponse;
      setTenants(Array.isArray(body.data) ? body.data : []);
      setAuthenticated(true);
      toast.success("Conectado");
    } catch {
      setAuthenticated(false);
      setTenants([]);
      const msg = "Falha de rede ao tentar conectar.";
      setAuthError(msg);
      toast.error("Erro de rede", { description: msg });
    } finally {
      setLoading(false);
    }
  }, [apiBase, apiKey, canTryLogin]);

  const createTenant = useCallback(async () => {
    if (!authenticated) return;
    const slug = createSlug.trim();
    const name = createName.trim();
    const contract_code = createContract.trim();
    if (!slug || !name || !contract_code) {
      toast.error("Campos obrigatórios", {
        description: "Preencha slug, nome e código de contrato.",
      });
      return;
    }
    setLoading(true);
    try {
      const res = await adminFetch(apiBase, "/admin/tenants", apiKey, {
        method: "POST",
        body: JSON.stringify({ slug, name, contract_code }),
      });
      const text = await res.text();
      if (!res.ok) {
        toast.error("Erro ao criar tenant", { description: text });
        return;
      }
      toast.success("Tenant criado");
      setCreateSlug("");
      setCreateName("");
      setCreateContract("");
      await connect();
    } catch (e: unknown) {
      toast.error("Erro", {
        description: e instanceof Error ? e.message : String(e),
      });
    } finally {
      setLoading(false);
    }
  }, [apiBase, apiKey, authenticated, connect, createContract, createName, createSlug]);

  const alterContract = useCallback(async () => {
    if (!authenticated) return;
    const slug = selectedSlug.trim();
    const contract_code = newContractCode.trim();
    const email = boundLogin.trim();
    if (!slug) {
      toast.error("Selecione um tenant");
      return;
    }
    if (!contract_code || !email) {
      toast.error("Campos obrigatórios", {
        description: "Novo código e e-mail (bound login) são obrigatórios.",
      });
      return;
    }
    setLoading(true);
    try {
      const path = `/admin/tenants/by-slug/${encodeURIComponent(slug)}/contract-code`;
      const res = await adminFetch(apiBase, path, apiKey, {
        method: "PUT",
        body: JSON.stringify({ contract_code, bound_login: email }),
      });
      const text = await res.text();
      if (!res.ok) {
        toast.error("Erro ao alterar contrato", { description: text });
        return;
      }
      toast.success("Contrato atualizado");
      setNewContractCode("");
      setBoundLogin("");
      await connect();
    } catch (e: unknown) {
      toast.error("Erro", {
        description: e instanceof Error ? e.message : String(e),
      });
    } finally {
      setLoading(false);
    }
  }, [
    apiBase,
    apiKey,
    authenticated,
    boundLogin,
    connect,
    newContractCode,
    selectedSlug,
  ]);

  const uploadXlsx = useCallback(async () => {
    if (!authenticated) return;
    if (!selectedSlug) {
      toast.error("Selecione um tenant");
      return;
    }
    if (!xlsxFile) {
      toast.error("Selecione uma planilha (.xlsx)");
      return;
    }
    setLoading(true);
    try {
      const buf = new Uint8Array(await xlsxFile.arrayBuffer());
      const path = `/admin/tenants/by-slug/${encodeURIComponent(selectedSlug)}/import/xlsx`;
      const out = await window.adminStock?.upload?.({
        path,
        apiKey,
        filename: xlsxFile.name || "import.xlsx",
        contentType:
          xlsxFile.type ||
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        fieldName: "file",
        bytes: buf,
      });
      if (!out) {
        toast.error("Upload indisponível", {
          description: "A janela precisa estar rodando via Electron.",
        });
        return;
      }
      if (!out.ok) {
        toast.error("Erro ao importar XLSX", { description: out.text });
        return;
      }
      toast.success("Planilha importada");
      setXlsxFile(null);
      await connect();
    } catch (e: unknown) {
      toast.error("Erro", {
        description: e instanceof Error ? e.message : String(e),
      });
    } finally {
      setLoading(false);
    }
  }, [apiKey, authenticated, connect, selectedSlug, xlsxFile]);

  const uploadPgDump = useCallback(async () => {
    if (!authenticated) return;
    if (!selectedSlug) {
      toast.error("Selecione um tenant");
      return;
    }
    if (!dumpFile) {
      toast.error("Selecione um dump (.sql ou .sql.gz)");
      return;
    }
    setLoading(true);
    try {
      const buf = new Uint8Array(await dumpFile.arrayBuffer());
      const qs = birthDateFallback.trim()
        ? `?birthDateFallback=${encodeURIComponent(birthDateFallback.trim())}`
        : "";
      const path = `/admin/tenants/by-slug/${encodeURIComponent(selectedSlug)}/import/pg-dump${qs}`;
      const out = await window.adminStock?.upload?.({
        path,
        apiKey,
        filename: dumpFile.name || "dump.sql",
        contentType: dumpFile.type || "application/sql",
        fieldName: "file",
        bytes: buf,
      });
      if (!out) {
        toast.error("Upload indisponível", {
          description: "A janela precisa estar rodando via Electron.",
        });
        return;
      }
      if (!out.ok) {
        toast.error("Erro ao importar dump", { description: out.text });
        return;
      }
      let summary = "";
      try {
        const j = JSON.parse(out.text) as any;
        if (j?.summary) summary = JSON.stringify(j.summary);
      } catch {
        // ignore
      }
      toast.success("Dump importado", summary ? { description: summary } : undefined);
      setDumpFile(null);
      await connect();
    } catch (e: unknown) {
      toast.error("Erro", {
        description: e instanceof Error ? e.message : String(e),
      });
    } finally {
      setLoading(false);
    }
  }, [apiKey, authenticated, birthDateFallback, connect, dumpFile, selectedSlug]);

  return (
    <div className="min-h-screen w-full flex items-center justify-center p-6">
      <AppToaster />
      <div className="w-full max-w-3xl">
        {!authenticated ? (
          <Card className="mx-auto max-w-md">
            <CardHeader className="pb-4">
              <div className="flex items-center gap-3">
                <LogoMark className="h-12 w-12 drop-shadow-sm" />
                <div className="min-w-0">
                  <CardTitle className="text-lg">Stokio Admin</CardTitle>
                  <CardDescription>
                    Insira a chave de acesso para continuar.
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="space-y-2">
                <Label htmlFor="key">Chave de acesso</Label>
                <Input
                  id="key"
                  type="password"
                  value={apiKey}
                  onChange={(e) => {
                    setApiKey(e.target.value);
                    setAuthenticated(false);
                  }}
                  disabled={loading}
                  autoComplete="off"
                  placeholder="********"
                />
                {authError ? (
                  <p className="text-sm text-red-600">{authError}</p>
                ) : null}
              </div>
              <Button
                className="w-full"
                disabled={loading || !canTryLogin}
                onClick={() => void connect()}
              >
                Entrar
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-3">
            <header className="flex items-baseline justify-between gap-3 px-1">
              <div>
                <div className="flex items-center gap-3">
                  <LogoMark className="h-10 w-10 drop-shadow-sm" />
                  <h1 className="text-xl font-semibold tracking-tight">
                    StoKIO
                  </h1>
                </div>
                <p className="text-sm text-[hsl(var(--muted-foreground))]">
                  Tenants e contratos.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-2 rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] px-3 py-2 shadow-sm">
                  <Label htmlFor="theme" className="text-xs">
                    Tema
                  </Label>
                  <select
                    id="theme"
                    className="h-7 rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--card))] px-2 text-sm outline-none ring-offset-[hsl(var(--background))] focus-visible:ring-2 focus-visible:ring-[hsl(var(--ring))] focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                    value={theme}
                    onChange={(e) => setTheme(e.target.value)}
                    disabled={loading}
                    aria-label="Selecionar tema"
                  >
                    <option value="abrigo">Abrigo</option>
                    <option value="ocean">Ocean</option>
                    <option value="slate">Slate</option>
                    <option value="dark">Dark</option>
                  </select>
                </div>

                <Button
                  variant="secondary"
                  disabled={loading}
                  onClick={() => void connect()}
                >
                  <RefreshCw className="h-4 w-4" />
                  Atualizar
                </Button>
              </div>
            </header>

            <Card>
              <CardHeader className="pb-4">
                <CardTitle>Criar tenant</CardTitle>
                <CardDescription>
                  Cria o abrigo e configura contrato/módulos automaticamente.
                </CardDescription>
              </CardHeader>
              <CardContent className="grid gap-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="slug">Slug</Label>
                    <Input
                      id="slug"
                      value={createSlug}
                      onChange={(e) => setCreateSlug(e.target.value)}
                      disabled={loading}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="name">Nome</Label>
                    <Input
                      id="name"
                      value={createName}
                      onChange={(e) => setCreateName(e.target.value)}
                      disabled={loading}
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="contract">Código de contrato</Label>
                  <Input
                    id="contract"
                    value={createContract}
                    onChange={(e) => setCreateContract(e.target.value)}
                    disabled={loading}
                  />
                </div>
                <Button disabled={loading} onClick={() => void createTenant()}>
                  Criar tenant
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-4">
                <CardTitle>Alterar código de contrato</CardTitle>
                <CardDescription>
                  Selecione um tenant e informe o novo código + e-mail vinculado.
                </CardDescription>
              </CardHeader>
              <CardContent className="grid gap-4">
                <div className="space-y-2">
                  <Label htmlFor="tenantSlug">Slug</Label>
                  <select
                    id="tenantSlug"
                    className="flex h-10 w-full rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] px-3 py-2 text-sm outline-none ring-offset-[hsl(var(--background))] focus-visible:ring-2 focus-visible:ring-[hsl(var(--ring))] focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                    value={selectedSlug}
                    onChange={(e) => {
                      setSelectedSlug(e.target.value);
                      setNewContractCode("");
                      setBoundLogin("");
                    }}
                    disabled={loading || tenants.length === 0}
                  >
                    <option value="">— selecionar —</option>
                    {tenants.map((t) => (
                      <option key={t.id} value={t.slug}>
                        {t.slug}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="tenantResolved">Tenant</Label>
                  <Input
                    id="tenantResolved"
                    value={
                      selectedTenant
                        ? `${selectedTenant.name} (#${selectedTenant.id})`
                        : ""
                    }
                    disabled
                    placeholder="Selecione um slug para ver o tenant"
                  />
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="newContract">Novo código de contrato</Label>
                    <Input
                      id="newContract"
                      value={newContractCode}
                      onChange={(e) => setNewContractCode(e.target.value)}
                      disabled={loading || !selectedSlug}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="boundLogin">E-mail (bound login)</Label>
                    <Input
                      id="boundLogin"
                      type="email"
                      value={boundLogin}
                      onChange={(e) => setBoundLogin(e.target.value)}
                      disabled={loading || !selectedSlug}
                    />
                  </div>
                </div>

                <Button
                  variant="secondary"
                  disabled={loading || !selectedSlug}
                  onClick={() => void alterContract()}
                >
                  Guardar alteração
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-4">
                <CardTitle>Upload de planilhas / dump</CardTitle>
                <CardDescription>
                  Importação por tenant (slug). Use XLSX para importar dados e pg_dump
                  (.sql/.sql.gz) para anexar dados operacionais.
                </CardDescription>
              </CardHeader>
              <CardContent className="grid gap-5">
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="xlsx">Planilha (.xlsx)</Label>
                    <Input
                      id="xlsx"
                      type="file"
                      accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                      disabled={loading}
                      onChange={(e) =>
                        setXlsxFile(e.target.files?.[0] ?? null)
                      }
                    />
                    <Button
                      variant="secondary"
                      disabled={loading || !selectedSlug || !xlsxFile}
                      onClick={() => void uploadXlsx()}
                    >
                      Importar XLSX
                    </Button>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="dump">Dump (.sql / .sql.gz)</Label>
                    <Input
                      id="dump"
                      type="file"
                      accept=".sql,.gz,application/sql,application/gzip"
                      disabled={loading}
                      onChange={(e) =>
                        setDumpFile(e.target.files?.[0] ?? null)
                      }
                    />
                    <div className="space-y-2">
                      <Label htmlFor="birth">birthDateFallback (opcional)</Label>
                      <Input
                        id="birth"
                        placeholder="1970-01-03"
                        value={birthDateFallback}
                        onChange={(e) => setBirthDateFallback(e.target.value)}
                        disabled={loading}
                      />
                    </div>
                    <Button
                      variant="secondary"
                      disabled={loading || !selectedSlug || !dumpFile}
                      onClick={() => void uploadPgDump()}
                    >
                      Importar dump
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}

import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import {
  adminFetch,
  normalizeBase,
  type AdminTenant,
  type TenantsResponse,
} from "@/lib/admin-api";
import {
  readInitialApiBase,
  readInitialApiKey,
  STORAGE_KEY_API,
  THEME_KEY,
} from "@/lib/app-settings";

export function useAdminApp() {
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
  const [adminTab, setAdminTab] = useState<
    "tenants" | "system" | "infra" | "errors"
  >("tenants");

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY_API, apiKey);
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

  const configRequest = useCallback(
    (path: string, init?: RequestInit) =>
      adminFetch(apiBase, path, apiKey, init),
    [apiBase, apiKey],
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
        } catch {}
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

  const disconnect = useCallback(() => {
    setAuthenticated(false);
    setTenants([]);
    setAdminTab("tenants");
    setSelectedSlug("");
    toast.message("Sessão terminada");
  }, []);

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
      const path = `/admin/tenants/by-slug/${encodeURIComponent(selectedSlug)}/import/xlsx/async`;
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
      let jobId: string | null = null;
      try {
        const j = JSON.parse(out.text) as { jobId?: string };
        if (typeof j?.jobId === "string") jobId = j.jobId;
      } catch {}
      if (!jobId) {
        toast.error("Resposta inválida do servidor", {
          description: "Não foi possível obter o jobId da importação.",
        });
        return;
      }

      toast.message("Importação enfileirada", {
        description: `Job ${jobId}. Aguardando processamento…`,
      });

      const statusPath = `/admin/tenants/by-slug/${encodeURIComponent(selectedSlug)}/import/jobs/${encodeURIComponent(jobId)}`;
      const startedAt = Date.now();
      while (Date.now() - startedAt < 1000 * 60 * 60) {
        await new Promise((r) => setTimeout(r, 2000));
        const s = await window.adminStock?.request?.({
          path: statusPath,
          apiKey,
        });
        if (!s?.ok) continue;
        try {
          const job = JSON.parse(s.text) as {
            status?: string;
            error?: string;
          };
          if (job?.status === "succeeded") {
            toast.success("Planilha importada");
            setXlsxFile(null);
            await connect();
            return;
          }
          if (job?.status === "failed") {
            toast.error("Importação falhou", {
              description: String(job?.error ?? "Erro desconhecido"),
            });
            return;
          }
        } catch {}
      }
      toast.message("Importação em andamento", {
        description:
          "O job ainda está processando. Você pode aguardar e tentar novamente.",
      });
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
      const path = `/admin/tenants/by-slug/${encodeURIComponent(selectedSlug)}/import/pg-dump/async${qs}`;
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
      let jobId: string | null = null;
      try {
        const j = JSON.parse(out.text) as { jobId?: string };
        if (typeof j?.jobId === "string") jobId = j.jobId;
      } catch {}
      if (!jobId) {
        toast.error("Resposta inválida do servidor", {
          description: "Não foi possível obter o jobId da importação.",
        });
        return;
      }

      toast.message("Importação enfileirada", {
        description: `Job ${jobId}. Aguardando processamento…`,
      });

      const statusPath = `/admin/tenants/by-slug/${encodeURIComponent(selectedSlug)}/import/jobs/${encodeURIComponent(jobId)}`;
      const startedAt = Date.now();
      while (Date.now() - startedAt < 1000 * 60 * 60) {
        await new Promise((r) => setTimeout(r, 2500));
        const s = await window.adminStock?.request?.({
          path: statusPath,
          apiKey,
        });
        if (!s?.ok) continue;
        try {
          const job = JSON.parse(s.text) as {
            status?: string;
            error?: string;
            result_json?: { summary?: unknown };
          };
          if (job?.status === "succeeded") {
            let summary = "";
            const result = job?.result_json;
            if (result?.summary) summary = JSON.stringify(result.summary);
            toast.success(
              "Dump importado",
              summary ? { description: summary } : undefined,
            );
            setDumpFile(null);
            await connect();
            return;
          }
          if (job?.status === "failed") {
            toast.error("Importação falhou", {
              description: String(job?.error ?? "Erro desconhecido"),
            });
            return;
          }
        } catch {}
      }
      toast.message("Importação em andamento", {
        description:
          "O job ainda está processando. Você pode aguardar e tentar novamente.",
      });
    } catch (e: unknown) {
      toast.error("Erro", {
        description: e instanceof Error ? e.message : String(e),
      });
    } finally {
      setLoading(false);
    }
  }, [apiKey, authenticated, birthDateFallback, connect, dumpFile, selectedSlug]);

  return {
    apiBase,
    apiKey,
    setApiKey,
    authenticated,
    loading,
    authError,
    tenants,
    createSlug,
    setCreateSlug,
    createName,
    setCreateName,
    createContract,
    setCreateContract,
    theme,
    setTheme,
    selectedSlug,
    setSelectedSlug,
    newContractCode,
    setNewContractCode,
    boundLogin,
    setBoundLogin,
    xlsxFile,
    setXlsxFile,
    dumpFile,
    setDumpFile,
    birthDateFallback,
    setBirthDateFallback,
    adminTab,
    setAdminTab,
    canTryLogin,
    selectedTenant,
    configRequest,
    connect,
    disconnect,
    createTenant,
    alterContract,
    uploadXlsx,
    uploadPgDump,
  };
}

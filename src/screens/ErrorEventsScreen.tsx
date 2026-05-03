import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Copy, RefreshCw } from "lucide-react";

import { PageHeader } from "@/components/layout/PageHeader";
import { Badge } from "@/components/ui/badge";
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
import { cn } from "@/lib/utils";

type RequestFn = (path: string, init?: RequestInit) => Promise<Response>;

export type ErrorEventsSummary = {
  last24h: number;
  last7d: number;
  last30d: number;
  topSources7d: { key: string; cnt: number }[];
  topCodes7d: { key: string; cnt: number }[];
  bySeverity7d: { severity: string; cnt: number }[];
};

export type ErrorEventRow = {
  id: string;
  occurredAt: string;
  receivedAt?: string;
  source: string;
  severity: string;
  category: string;
  code: string | null;
  messageRaw: string;
  messageSanitized?: string | null;
  fingerprint: string;
  correlationId?: string | null;
  tenantId?: number | null;
  httpMethod?: string | null;
  httpPath?: string | null;
  httpStatus?: number | null;
  workflowId?: string | null;
  workflowRunId?: string | null;
  originApp?: string | null;
  contextJson?: unknown;
  stack?: string | null;
};

const SOURCE_OPTS = [
  "",
  "backend_http",
  "temporal",
  "price_search",
  "frontend_web",
  "sdk",
];
const SEVERITY_OPTS = ["", "info", "warning", "error", "fatal"];
const CATEGORY_OPTS = [
  "",
  "validation",
  "auth",
  "database",
  "integration",
  "route",
  "workflow",
  "config",
  "unknown",
];

function truncate(s: string, n: number): string {
  if (s.length <= n) return s;
  return `${s.slice(0, n)}…`;
}

function buildListQuery(params: {
  page: number;
  limit: number;
  source: string;
  severity: string;
  category: string;
  code: string;
  tenantId: string;
  from: string;
  to: string;
  q: string;
  correlationId: string;
}): string {
  const sp = new URLSearchParams();
  sp.set("page", String(params.page));
  sp.set("limit", String(params.limit));
  if (params.source) sp.set("source", params.source);
  if (params.severity) sp.set("severity", params.severity);
  if (params.category) sp.set("category", params.category);
  if (params.code.trim()) sp.set("code", params.code.trim());
  if (params.tenantId.trim()) sp.set("tenantId", params.tenantId.trim());
  if (params.from) sp.set("from", new Date(params.from).toISOString());
  if (params.to) sp.set("to", new Date(params.to).toISOString());
  if (params.q.trim()) sp.set("q", params.q.trim());
  if (params.correlationId.trim())
    sp.set("correlationId", params.correlationId.trim());
  return `/admin/error-events?${sp.toString()}`;
}

function temporalWorkflowHref(workflowId: string): string | null {
  const base = import.meta.env.VITE_TEMPORAL_WEB_URL?.trim();
  if (!base) return null;
  const b = base.replace(/\/+$/, "");
  return `${b}/namespaces/default/workflows/${encodeURIComponent(workflowId)}`;
}

async function copyText(text: string): Promise<void> {
  try {
    await navigator.clipboard.writeText(text);
    toast.success("Copiado");
  } catch {
    toast.error("Não foi possível copiar");
  }
}

export function ErrorEventsScreen({
  request,
  disabled,
}: {
  request: RequestFn;
  disabled: boolean;
}) {
  const [summary, setSummary] = useState<ErrorEventsSummary | null>(null);
  const [rows, setRows] = useState<ErrorEventRow[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [limit] = useState(25);
  const [loading, setLoading] = useState(true);
  const [listLoading, setListLoading] = useState(false);
  const [selected, setSelected] = useState<ErrorEventRow | null>(null);

  const [source, setSource] = useState("");
  const [severity, setSeverity] = useState("");
  const [category, setCategory] = useState("");
  const [code, setCode] = useState("");
  const [tenantId, setTenantId] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [q, setQ] = useState("");
  const [correlationId, setCorrelationId] = useState("");

  const topSourceLabel = useMemo(() => {
    const t = summary?.topSources7d?.[0];
    return t ? `${t.key} (${t.cnt})` : "—";
  }, [summary]);

  const topCodeLabel = useMemo(() => {
    const t = summary?.topCodes7d?.[0];
    return t ? `${t.key} (${t.cnt})` : "—";
  }, [summary]);

  const loadSummary = useCallback(async () => {
    try {
      const res = await request("/admin/error-events/summary");
      if (!res.ok) {
        toast.error("Resumo de erros", { description: await res.text() });
        return;
      }
      setSummary((await res.json()) as ErrorEventsSummary);
    } catch (e: unknown) {
      toast.error("Resumo de erros", {
        description: e instanceof Error ? e.message : String(e),
      });
    }
  }, [request]);

  const loadList = useCallback(async () => {
    setListLoading(true);
    try {
      const path = buildListQuery({
        page,
        limit,
        source,
        severity,
        category,
        code,
        tenantId,
        from,
        to,
        q,
        correlationId,
      });
      const res = await request(path);
      if (!res.ok) {
        toast.error("Lista de erros", { description: await res.text() });
        return;
      }
      const body = (await res.json()) as {
        data?: ErrorEventRow[];
        total?: number;
      };
      setRows(Array.isArray(body.data) ? body.data : []);
      setTotal(typeof body.total === "number" ? body.total : 0);
    } catch (e: unknown) {
      toast.error("Lista de erros", {
        description: e instanceof Error ? e.message : String(e),
      });
    } finally {
      setListLoading(false);
    }
  }, [
    request,
    page,
    limit,
    source,
    severity,
    category,
    code,
    tenantId,
    from,
    to,
    q,
    correlationId,
  ]);

  const loadDetail = useCallback(
    async (id: string) => {
      try {
        const res = await request(`/admin/error-events/${encodeURIComponent(id)}`);
        if (!res.ok) {
          toast.error("Detalhe", { description: await res.text() });
          return;
        }
        setSelected((await res.json()) as ErrorEventRow);
      } catch (e: unknown) {
        toast.error("Detalhe", {
          description: e instanceof Error ? e.message : String(e),
        });
      }
    },
    [request],
  );

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      await loadSummary();
      if (!cancelled) setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [loadSummary]);

  useEffect(() => {
    const id = window.setInterval(() => {
      void loadSummary();
    }, 60_000);
    return () => window.clearInterval(id);
  }, [loadSummary]);

  useEffect(() => {
    void loadList();
  }, [loadList]);

  const totalPages = Math.max(1, Math.ceil(total / limit));

  return (
    <div className="space-y-6">
      <PageHeader
        title="Erros"
        description="Eventos canónicos registados (HTTP, Temporal, price-search, frontend)."
        action={
          <Button
            type="button"
            variant="secondary"
            size="sm"
            disabled={disabled || loading}
            onClick={() => void loadSummary().then(() => void loadList())}
          >
            <RefreshCw className="h-4 w-4" />
            Atualizar
          </Button>
        }
      />

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Últimas 24 h</CardDescription>
            <CardTitle className="text-2xl tabular-nums">
              {summary?.last24h ?? "—"}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Últimos 7 dias</CardDescription>
            <CardTitle className="text-2xl tabular-nums">
              {summary?.last7d ?? "—"}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Top fonte (7d)</CardDescription>
            <CardTitle className="truncate text-base font-medium">
              {topSourceLabel}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Top código (7d)</CardDescription>
            <CardTitle className="truncate text-base font-medium">
              {topCodeLabel}
            </CardTitle>
          </CardHeader>
        </Card>
      </div>

      {summary?.bySeverity7d?.length ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Por severidade (7d)</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            {summary.bySeverity7d.map((s) => (
              <Badge key={s.severity} variant="outline">
                {s.severity}: {s.cnt}
              </Badge>
            ))}
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Filtros</CardTitle>
          <CardDescription>
            Auto-atualização do resumo a cada 60 s. A lista atualiza ao mudar
            filtros ou página.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <div className="space-y-2">
            <Label htmlFor="flt-source">Origem</Label>
            <select
              id="flt-source"
              className="flex h-9 w-full rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--card))] px-2 text-sm"
              value={source}
              onChange={(e) => {
                setPage(1);
                setSource(e.target.value);
              }}
              disabled={disabled}
            >
              {SOURCE_OPTS.map((o) => (
                <option key={o || "all"} value={o}>
                  {o || "(todas)"}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="flt-severity">Severidade</Label>
            <select
              id="flt-severity"
              className="flex h-9 w-full rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--card))] px-2 text-sm"
              value={severity}
              onChange={(e) => {
                setPage(1);
                setSeverity(e.target.value);
              }}
              disabled={disabled}
            >
              {SEVERITY_OPTS.map((o) => (
                <option key={o || "all"} value={o}>
                  {o || "(todas)"}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="flt-category">Categoria</Label>
            <select
              id="flt-category"
              className="flex h-9 w-full rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--card))] px-2 text-sm"
              value={category}
              onChange={(e) => {
                setPage(1);
                setCategory(e.target.value);
              }}
              disabled={disabled}
            >
              {CATEGORY_OPTS.map((o) => (
                <option key={o || "all"} value={o}>
                  {o || "(todas)"}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="flt-code">Código</Label>
            <Input
              id="flt-code"
              value={code}
              onChange={(e) => {
                setPage(1);
                setCode(e.target.value);
              }}
              disabled={disabled}
              placeholder="ex. prisma_p2002"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="flt-tenant">Tenant ID</Label>
            <Input
              id="flt-tenant"
              value={tenantId}
              onChange={(e) => {
                setPage(1);
                setTenantId(e.target.value);
              }}
              disabled={disabled}
              placeholder="número"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="flt-q">Mensagem contém</Label>
            <Input
              id="flt-q"
              value={q}
              onChange={(e) => {
                setPage(1);
                setQ(e.target.value);
              }}
              disabled={disabled}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="flt-from">De</Label>
            <Input
              id="flt-from"
              type="datetime-local"
              value={from}
              onChange={(e) => {
                setPage(1);
                setFrom(e.target.value);
              }}
              disabled={disabled}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="flt-to">Até</Label>
            <Input
              id="flt-to"
              type="datetime-local"
              value={to}
              onChange={(e) => {
                setPage(1);
                setTo(e.target.value);
              }}
              disabled={disabled}
            />
          </div>
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="flt-corr">Correlation ID</Label>
            <Input
              id="flt-corr"
              value={correlationId}
              onChange={(e) => {
                setPage(1);
                setCorrelationId(e.target.value);
              }}
              disabled={disabled}
            />
          </div>
        </CardContent>
      </Card>

      <div className="relative overflow-x-auto rounded-xl border border-[hsl(var(--border))]">
        <table className="w-full min-w-[720px] text-left text-sm">
          <thead className="border-b border-[hsl(var(--border))] bg-[hsl(var(--muted))]/40">
            <tr>
              <th className="px-3 py-2 font-medium">Quando</th>
              <th className="px-3 py-2 font-medium">Origem</th>
              <th className="px-3 py-2 font-medium">Sev.</th>
              <th className="px-3 py-2 font-medium">Código</th>
              <th className="px-3 py-2 font-medium">HTTP</th>
              <th className="px-3 py-2 font-medium">Path</th>
              <th className="px-3 py-2 font-medium">Mensagem</th>
            </tr>
          </thead>
          <tbody>
            {listLoading && rows.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-3 py-8 text-center text-muted-foreground">
                  A carregar…
                </td>
              </tr>
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-3 py-8 text-center text-muted-foreground">
                  Sem eventos para os filtros actuais.
                </td>
              </tr>
            ) : (
              rows.map((r) => (
                <tr
                  key={r.id}
                  className={cn(
                    "cursor-pointer border-b border-[hsl(var(--border))]/60 hover:bg-[hsl(var(--muted))]/30",
                    selected?.id === r.id && "bg-[hsl(var(--muted))]/50",
                  )}
                  onClick={() => {
                    void loadDetail(r.id);
                  }}
                >
                  <td className="whitespace-nowrap px-3 py-2 text-xs text-[hsl(var(--muted-foreground))]">
                    {new Date(r.occurredAt).toLocaleString()}
                  </td>
                  <td className="px-3 py-2">{r.source}</td>
                  <td className="px-3 py-2">
                    <Badge variant="outline" className="text-xs">
                      {r.severity}
                    </Badge>
                  </td>
                  <td className="max-w-[120px] truncate px-3 py-2 font-mono text-xs">
                    {r.code ?? "—"}
                  </td>
                  <td className="px-3 py-2 tabular-nums">
                    {r.httpStatus ?? "—"}
                  </td>
                  <td className="max-w-[180px] truncate px-3 py-2 text-xs">
                    {r.httpPath ?? "—"}
                  </td>
                  <td className="max-w-[280px] truncate px-3 py-2 text-xs">
                    {truncate(r.messageRaw, 96)}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-[hsl(var(--muted-foreground))]">
          Página {page} de {totalPages} · {total} eventos
        </p>
        <div className="flex gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={disabled || page <= 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
          >
            Anterior
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={disabled || page >= totalPages}
            onClick={() => setPage((p) => p + 1)}
          >
            Seguinte
          </Button>
        </div>
      </div>

      {selected ? (
        <div
          className="fixed inset-0 z-50 flex justify-end bg-black/40 p-4 backdrop-blur-[1px]"
          role="presentation"
          onClick={() => setSelected(null)}
        >
          <div
            role="dialog"
            aria-modal
            className="flex h-full max-h-[90vh] w-full max-w-lg flex-col overflow-hidden rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-[hsl(var(--border))] px-4 py-3">
              <h2 className="font-semibold">Detalhe do evento</h2>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setSelected(null)}
              >
                Fechar
              </Button>
            </div>
            <div className="flex-1 space-y-3 overflow-y-auto p-4 text-sm">
              <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-xs">
                <dt className="text-[hsl(var(--muted-foreground))]">ID</dt>
                <dd className="break-all font-mono">{selected.id}</dd>
                <dt className="text-[hsl(var(--muted-foreground))]">Quando</dt>
                <dd>{new Date(selected.occurredAt).toLocaleString()}</dd>
                <dt className="text-[hsl(var(--muted-foreground))]">Origem</dt>
                <dd>{selected.source}</dd>
                <dt className="text-[hsl(var(--muted-foreground))]">Fingerprint</dt>
                <dd className="break-all font-mono">{selected.fingerprint}</dd>
                {selected.correlationId ? (
                  <>
                    <dt className="text-[hsl(var(--muted-foreground))]">
                      Correlation
                    </dt>
                    <dd className="flex flex-wrap items-center gap-2">
                      <span className="break-all font-mono">
                        {selected.correlationId}
                      </span>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="h-7 px-2"
                        onClick={() => void copyText(selected.correlationId!)}
                      >
                        <Copy className="h-3 w-3" />
                      </Button>
                    </dd>
                  </>
                ) : null}
                {selected.workflowId ? (
                  <>
                    <dt className="text-[hsl(var(--muted-foreground))]">
                      Workflow
                    </dt>
                    <dd className="break-all font-mono text-xs">
                      {temporalWorkflowHref(selected.workflowId) ? (
                        <a
                          href={temporalWorkflowHref(selected.workflowId)!}
                          target="_blank"
                          rel="noreferrer"
                          className="text-[hsl(var(--primary))] underline"
                        >
                          {selected.workflowId}
                        </a>
                      ) : (
                        selected.workflowId
                      )}
                    </dd>
                  </>
                ) : null}
              </dl>
              <div>
                <p className="mb-1 text-xs font-medium text-[hsl(var(--muted-foreground))]">
                  Mensagem
                </p>
                <pre className="whitespace-pre-wrap break-words rounded-lg bg-[hsl(var(--muted))]/40 p-2 text-xs">
                  {selected.messageRaw}
                </pre>
              </div>
              {selected.contextJson != null ? (
                <div>
                  <p className="mb-1 text-xs font-medium text-[hsl(var(--muted-foreground))]">
                    Context (JSON)
                  </p>
                  <pre className="max-h-48 overflow-auto whitespace-pre-wrap break-words rounded-lg bg-[hsl(var(--muted))]/40 p-2 text-xs">
                    {JSON.stringify(selected.contextJson, null, 2)}
                  </pre>
                </div>
              ) : null}
              {selected.stack ? (
                <div>
                  <p className="mb-1 text-xs font-medium text-[hsl(var(--muted-foreground))]">
                    Stack
                  </p>
                  <pre className="max-h-56 overflow-auto whitespace-pre-wrap break-words rounded-lg bg-[hsl(var(--muted))]/40 p-2 font-mono text-[11px] leading-relaxed">
                    {selected.stack}
                  </pre>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

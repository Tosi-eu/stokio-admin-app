import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Activity, RefreshCw } from "lucide-react";

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
import { cn } from "@/lib/utils";

type ServiceCheck = {
  status:
    | "ok"
    | "error"
    | "degraded"
    | "skipped"
    | "disabled"
    | "unavailable";
  latencyMs?: number;
  detail?: string;
  url?: string;
  httpStatus?: number;
};

export type InfraHealthResponse = {
  checkedAt: string;
  services: {
    database: ServiceCheck;
    redis: ServiceCheck;
    temporal: ServiceCheck;
  };
};

type RequestFn = (path: string, init?: RequestInit) => Promise<Response>;

function statusBadgeVariant(
  s: ServiceCheck["status"],
): "success" | "secondary" | "outline" {
  if (s === "ok") return "success";
  if (s === "skipped" || s === "disabled") return "secondary";
  return "outline";
}

function statusLabel(s: ServiceCheck["status"]): string {
  switch (s) {
    case "ok":
      return "OK";
    case "error":
      return "Erro";
    case "degraded":
      return "Degradado";
    case "skipped":
      return "Ignorado";
    case "disabled":
      return "Desligado";
    case "unavailable":
      return "Indisponível";
    default:
      return s;
  }
}

const rows: {
  key: keyof InfraHealthResponse["services"];
  title: string;
  hint: string;
}[] = [
  {
    key: "database",
    title: "PostgreSQL",
    hint: "SELECT 1 na base principal.",
  },
  {
    key: "redis",
    title: "Redis",
    hint: "Cache / rate limit / locks.",
  },
  {
    key: "temporal",
    title: "Temporal",
    hint: "Ligação gRPC ao servidor Temporal (workflows).",
  },
];

export function InfraHealthScreen({
  request,
  disabled,
}: {
  request: RequestFn;
  disabled: boolean;
}) {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [data, setData] = useState<InfraHealthResponse | null>(null);

  const load = useCallback(async () => {
    setRefreshing(true);
    try {
      const res = await request("/admin/infra-health");
      const body = (await res.json().catch(() => ({}))) as
        | InfraHealthResponse
        | { error?: string };
      if (!res.ok) {
        const err = "error" in body ? body.error : undefined;
        throw new Error(
          typeof err === "string" ? err : `HTTP ${res.status}`,
        );
      }
      setData(body as InfraHealthResponse);
    } catch (e: unknown) {
      toast.error("Erro ao carregar saúde da infra", {
        description: e instanceof Error ? e.message : String(e),
      });
      setData(null);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [request]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    const id = window.setInterval(() => void load(), 25_000);
    return () => window.clearInterval(id);
  }, [load]);

  const blocked = disabled || loading;

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-8 px-4 py-8 md:px-8">
      <PageHeader
        title="Infraestrutura"
        description="PostgreSQL, Redis e Temporal — actualização automática a cada 25s."
      />

      <Card>
        <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-4 pb-4">
          <div className="space-y-1">
            <CardTitle className="flex items-center gap-2 text-lg">
              <Activity className="h-5 w-5 opacity-80" aria-hidden />
              Serviços
            </CardTitle>
            <CardDescription>
              Verificações feitas a partir do processo da API (ligação à base,
              Redis e servidor Temporal).
            </CardDescription>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={blocked || refreshing}
            onClick={() => void load()}
            className="shrink-0 gap-2"
          >
            <RefreshCw
              className={cn("h-4 w-4", refreshing && "animate-spin")}
              aria-hidden
            />
            Actualizar
          </Button>
        </CardHeader>
        <CardContent className="space-y-4">
          {data?.checkedAt ? (
            <p className="text-xs text-[hsl(var(--muted-foreground))]">
              Última verificação:{" "}
              <time dateTime={data.checkedAt}>
                {new Date(data.checkedAt).toLocaleString()}
              </time>
            </p>
          ) : null}

          <ul className="divide-y divide-[hsl(var(--border))] rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))]">
            {rows.map(({ key, title, hint }) => {
              const svc = data?.services?.[key];
              return (
                <li
                  key={key}
                  className="flex flex-col gap-2 px-4 py-4 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="min-w-0 space-y-1">
                    <p className="font-medium text-[hsl(var(--foreground))]">
                      {title}
                    </p>
                    <p className="text-xs text-[hsl(var(--muted-foreground))]">
                      {hint}
                    </p>
                    {svc?.detail ? (
                      <p className="text-xs text-amber-700 dark:text-amber-400">
                        {svc.detail}
                      </p>
                    ) : null}
                    {svc?.url ? (
                      <p className="truncate font-mono text-xs text-[hsl(var(--muted-foreground))]">
                        {svc.url}
                      </p>
                    ) : null}
                  </div>
                  <div className="flex shrink-0 flex-wrap items-center gap-2 sm:justify-end">
                    {svc ? (
                      <>
                        <Badge variant={statusBadgeVariant(svc.status)}>
                          {statusLabel(svc.status)}
                        </Badge>
                        {svc.latencyMs != null ? (
                          <span className="text-xs tabular-nums text-[hsl(var(--muted-foreground))]">
                            {svc.latencyMs} ms
                          </span>
                        ) : null}
                        {svc.httpStatus != null ? (
                          <span className="text-xs tabular-nums text-[hsl(var(--muted-foreground))]">
                            HTTP {svc.httpStatus}
                          </span>
                        ) : null}
                      </>
                    ) : (
                      <span className="text-sm text-[hsl(var(--muted-foreground))]">
                        {loading ? "A carregar…" : "—"}
                      </span>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}

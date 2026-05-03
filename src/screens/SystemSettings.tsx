import { useCallback, useEffect, useId, useState } from "react";
import { toast } from "sonner";
import { PageHeader } from "@/components/layout/PageHeader";
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
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";

export type SystemConfigDto = {
  cors: { allowedOrigins: string[] };
  ttl: {
    healthcheckMs: number;
    authCacheSeconds: number;
    r2LogoListMs: number;
    jwtExpiresIn: string;
    allowCookieAuth: boolean;
  };
  retries: {
    pricingApi: { max: number; baseMs: number; maxMs: number };
  };
  concurrency: {
    pricingApi: { parallel: number; minIntervalMs: number };
    priceBackfill: {
      batch: number;
      maxPerTenant: number;
      interRequestDelayMs: number;
    };
  };
  rateLimits: {
    global: { windowMs: number; max: number };
    publicTenant: { windowMs: number; listMax: number; brandingMax: number };
  };
  pricing: { baseUrl: string; apiKey: string };
  scheduledPriceBackfill: {
    enabled: boolean;
    cronExpression: string;
    manualCooldownSuccessSec: number;
    manualCooldownErrorSec: number;
  };
  logging: { level: string; format: "json" | "pretty" };
  tenantImport: { pgDumpBirthDateFallback: string };
};

type AdminConfigResponse = {
  display: Record<string, string>;
  system: SystemConfigDto | null;
};

type RequestFn = (path: string, init?: RequestInit) => Promise<Response>;

function FieldHint({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <p
      className={cn(
        "text-xs leading-relaxed text-[hsl(var(--muted-foreground))]",
        className,
      )}
    >
      {children}
    </p>
  );
}

const selectClass =
  "flex h-10 w-full rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] px-3 py-2 text-sm outline-none ring-offset-[hsl(var(--background))] focus-visible:ring-2 focus-visible:ring-[hsl(var(--ring))] focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50";

export function SystemSettings({
  request,
  disabled,
}: {
  request: RequestFn;
  disabled: boolean;
}) {
  const formId = useId();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [cfg, setCfg] = useState<SystemConfigDto | null>(null);
  const [originsText, setOriginsText] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await request("/admin/config");
      if (!res.ok) {
        const j = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(j?.error ?? `HTTP ${res.status}`);
      }
      const body = (await res.json()) as AdminConfigResponse;
      if (!body.system) {
        setCfg(null);
        toast.error("Config do sistema indisponível", {
          description: "O backend não expôs o bloco system.",
        });
        return;
      }
      setCfg({
        ...body.system,
        tenantImport: body.system.tenantImport ?? {
          pgDumpBirthDateFallback: "1970-01-01",
        },
      });
      setOriginsText(body.system.cors.allowedOrigins.join("\n"));
    } catch (e: unknown) {
      toast.error("Erro ao carregar config", {
        description: e instanceof Error ? e.message : String(e),
      });
      setCfg(null);
    } finally {
      setLoading(false);
    }
  }, [request]);

  useEffect(() => {
    void load();
  }, [load]);

  const save = async () => {
    if (!cfg) return;
    const allowedOrigins = originsText
      .split(/[\n,]+/)
      .map((s) => s.trim())
      .filter(Boolean);
    if (allowedOrigins.length === 0) {
      toast.error("CORS", { description: "Indique pelo menos uma origem." });
      return;
    }
    setSaving(true);
    try {
      const next: SystemConfigDto = {
        ...cfg,
        cors: { allowedOrigins },
      };
      const res = await request("/admin/config", {
        method: "PUT",
        body: JSON.stringify({ system: next }),
      });
      if (!res.ok) {
        const j = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(j?.error ?? `HTTP ${res.status}`);
      }
      const body = (await res.json()) as AdminConfigResponse;
      if (body.system) {
        setCfg(body.system);
        setOriginsText(body.system.cors.allowedOrigins.join("\n"));
      }
      toast.success("Configuração guardada");
    } catch (e: unknown) {
      toast.error("Erro ao guardar", {
        description: e instanceof Error ? e.message : String(e),
      });
    } finally {
      setSaving(false);
    }
  };

  const fieldDisabled = disabled || saving;
  const inputsLocked = disabled || loading || !cfg;

  if (loading && !cfg) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Configuração do sistema</CardTitle>
          <CardDescription>A carregar…</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  if (!cfg) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Configuração do sistema</CardTitle>
          <CardDescription>Não foi possível carregar.</CardDescription>
        </CardHeader>
        <CardContent>
          <Button variant="secondary" onClick={() => void load()} disabled={disabled}>
            Tentar novamente
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-8 pb-4">
      <PageHeader
        title="Configuração do sistema"
        description="Parâmetros persistidos na tabela system_config e aplicados em tempo de execução. Redis, PostgreSQL e variáveis de ambiente do servidor configuram-se no Docker/host — não neste painel."
      />

      <div className="grid gap-6">
        {/* ——— Registo ——— */}
        <Card>
          <CardHeader className="pb-4">
            <CardTitle className="text-lg">Registo e diagnóstico</CardTitle>
            <CardDescription>
              Volume e formato das mensagens escritas na consola do processo da API.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-6 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor={`${formId}-log-level`}>Nível de detalhe dos logs</Label>
              <FieldHint>
                Quanto mais alto, mais eventos aparecem (útil em desenvolvimento;
                em produção prefira <code className="rounded bg-[hsl(var(--muted))] px-1 text-[11px]">info</code> ou{" "}
                <code className="rounded bg-[hsl(var(--muted))] px-1 text-[11px]">warn</code>).
              </FieldHint>
              <select
                id={`${formId}-log-level`}
                className={selectClass}
                value={cfg.logging.level}
                onChange={(e) =>
                  setCfg({
                    ...cfg,
                    logging: { ...cfg.logging, level: e.target.value },
                  })
                }
                disabled={fieldDisabled}
              >
                <option value="error">error — apenas falhas</option>
                <option value="warn">warn — avisos e erros</option>
                <option value="info">info — fluxo geral</option>
                <option value="http">http — pedidos HTTP</option>
                <option value="verbose">verbose — detalhe elevado</option>
                <option value="debug">debug — depuração</option>
                <option value="silly">silly — máximo detalhe</option>
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor={`${formId}-log-format`}>Formato na consola</Label>
              <FieldHint>
                JSON é adequado para agregadores; «pretty» facilita leitura humana local.
              </FieldHint>
              <select
                id={`${formId}-log-format`}
                className={selectClass}
                value={cfg.logging.format}
                onChange={(e) =>
                  setCfg({
                    ...cfg,
                    logging: {
                      ...cfg.logging,
                      format: e.target.value as "json" | "pretty",
                    },
                  })
                }
                disabled={fieldDisabled}
              >
                <option value="pretty">Legível (cores, indentação)</option>
                <option value="json">JSON (uma linha por evento)</option>
              </select>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-4">
            <CardTitle className="text-lg">Importação — pg_dump</CardTitle>
            <CardDescription>
              Data de nascimento por defeito quando o dump não traz valor válido para
              residentes (formato ISO <code className="text-[11px]">YYYY-MM-DD</code>).
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            <Label htmlFor={`${formId}-pgdump-birth`}>
              Data fallback (residentes)
            </Label>
            <FieldHint>
              Valor definido aqui tem prioridade sobre{" "}
              <code className="rounded bg-[hsl(var(--muted))] px-1 text-[11px]">
                IMPORT_BIRTH_DATE_FALLBACK
              </code>{" "}
              no processo. O query{" "}
              <code className="text-[11px]">birthDateFallback</code> por pedido continua acima de
              ambos.
            </FieldHint>
            <Input
              id={`${formId}-pgdump-birth`}
              value={cfg.tenantImport.pgDumpBirthDateFallback}
              onChange={(e) =>
                setCfg({
                  ...cfg,
                  tenantImport: {
                    ...cfg.tenantImport,
                    pgDumpBirthDateFallback: e.target.value.trim(),
                  },
                })
              }
              placeholder="1970-01-01"
              disabled={fieldDisabled}
              autoComplete="off"
            />
          </CardContent>
        </Card>

        {/* ——— CORS ——— */}
        <Card>
          <CardHeader className="pb-4">
            <CardTitle className="text-lg">CORS — origens do browser</CardTitle>
            <CardDescription>
              Domínios cujo JavaScript no navegador pode chamar esta API com credenciais
              ou cabeçalhos personalizados.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            <Label htmlFor={`${formId}-cors`}>URLs permitidos (um por linha)</Label>
            <FieldHint>
              Inclua o esquema completo, por exemplo{" "}
              <code className="rounded bg-[hsl(var(--muted))] px-1 text-[11px]">https://app.exemplo.pt</code>.
              Local:{" "}
              <code className="rounded bg-[hsl(var(--muted))] px-1 text-[11px]">http://localhost:5173</code>.
            </FieldHint>
            <textarea
              id={`${formId}-cors`}
              className="min-h-[120px] w-full rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-3 text-sm outline-none ring-offset-[hsl(var(--background))] focus-visible:ring-2 focus-visible:ring-[hsl(var(--ring))] focus-visible:ring-offset-2 disabled:opacity-50"
              value={originsText}
              onChange={(e) => setOriginsText(e.target.value)}
              disabled={fieldDisabled}
              spellCheck={false}
            />
          </CardContent>
        </Card>

        {/* ——— API de preços / price-search ——— */}
        <Card>
          <CardHeader className="pb-4">
            <CardTitle className="text-lg">Integração — API de preços (price-search)</CardTitle>
            <CardDescription>
              Ligação ao microserviço externo que resolve preços de produtos. URL e chave
              activam as chamadas; sem ambos, a integração permanece desactivada.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-6">
            <FieldHint>
              Em Docker Compose no mesmo host, costuma funcionar{" "}
              <code className="rounded bg-[hsl(var(--muted))] px-1 text-[11px]">http://127.0.0.1:3010</code> ou{" "}
              <code className="rounded bg-[hsl(var(--muted))] px-1 text-[11px]">http://localhost:3010</code>{" "}
              (o backend pode reescrever para o serviço <code className="text-[11px]">price-search</code>). Se o
              price-search correr na máquina anfitriã e a API dentro do contentor, use frequentemente{" "}
              <code className="rounded bg-[hsl(var(--muted))] px-1 text-[11px]">http://host.docker.internal:3010</code>.
            </FieldHint>
            <div className="grid gap-6 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor={`${formId}-pricing-url`}>URL base do serviço</Label>
                <FieldHint>Sem barra final; apenas o prefixo até ao host e porta.</FieldHint>
                <Input
                  id={`${formId}-pricing-url`}
                  value={cfg.pricing.baseUrl}
                  onChange={(e) =>
                    setCfg({
                      ...cfg,
                      pricing: { ...cfg.pricing, baseUrl: e.target.value },
                    })
                  }
                  placeholder="http://host.docker.internal:3010"
                  disabled={fieldDisabled}
                  autoComplete="off"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor={`${formId}-pricing-key`}>Chave de API do price-search</Label>
                <FieldHint>
                  Credencial esperada pelo serviço de preços (enviada nos pedidos HTTP).
                </FieldHint>
                <Input
                  id={`${formId}-pricing-key`}
                  type="password"
                  value={cfg.pricing.apiKey}
                  onChange={(e) =>
                    setCfg({
                      ...cfg,
                      pricing: { ...cfg.pricing, apiKey: e.target.value },
                    })
                  }
                  placeholder="••••••••"
                  disabled={fieldDisabled}
                  autoComplete="off"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* ——— Retries + concurrency pricing ——— */}
        <Card>
          <CardHeader className="pb-4">
            <CardTitle className="text-lg">Resiliência — chamadas HTTP à API de preços</CardTitle>
            <CardDescription>
              Comportamento quando o serviço de preços falha temporariamente ou limita a taxa
              de pedidos.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-8">
            <div>
              <p className="mb-3 text-sm font-medium text-[hsl(var(--foreground))]">
                Retentativas (backoff exponencial)
              </p>
              <div className="grid gap-4 sm:grid-cols-3">
                <div className="space-y-2">
                  <Label htmlFor={`${formId}-retry-max`}>Tentativas máximas por pedido</Label>
                  <FieldHint>Após esgotar, o erro propaga-se ao cliente.</FieldHint>
                  <Input
                    id={`${formId}-retry-max`}
                    type="number"
                    value={cfg.retries.pricingApi.max}
                    onChange={(e) =>
                      setCfg({
                        ...cfg,
                        retries: {
                          pricingApi: {
                            ...cfg.retries.pricingApi,
                            max: Number(e.target.value),
                          },
                        },
                      })
                    }
                    disabled={inputsLocked || saving}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor={`${formId}-retry-base`}>Primeira pausa entre tentativas (ms)</Label>
                  <FieldHint>Ponto de partida do backoff exponencial.</FieldHint>
                  <Input
                    id={`${formId}-retry-base`}
                    type="number"
                    value={cfg.retries.pricingApi.baseMs}
                    onChange={(e) =>
                      setCfg({
                        ...cfg,
                        retries: {
                          pricingApi: {
                            ...cfg.retries.pricingApi,
                            baseMs: Number(e.target.value),
                          },
                        },
                      })
                    }
                    disabled={inputsLocked || saving}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor={`${formId}-retry-cap`}>Teto da pausa entre tentativas (ms)</Label>
                  <FieldHint>O intervalo não ultrapassa este valor.</FieldHint>
                  <Input
                    id={`${formId}-retry-cap`}
                    type="number"
                    value={cfg.retries.pricingApi.maxMs}
                    onChange={(e) =>
                      setCfg({
                        ...cfg,
                        retries: {
                          pricingApi: {
                            ...cfg.retries.pricingApi,
                            maxMs: Number(e.target.value),
                          },
                        },
                      })
                    }
                    disabled={inputsLocked || saving}
                  />
                </div>
              </div>
            </div>

            <Separator />

            <div>
              <p className="mb-3 text-sm font-medium text-[hsl(var(--foreground))]">
                Concorrência no cliente HTTP
              </p>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor={`${formId}-conc-par`}>Pedidos paralelos ao price-search</Label>
                  <FieldHint>Número de chamadas simultâneas ao serviço externo.</FieldHint>
                  <Input
                    id={`${formId}-conc-par`}
                    type="number"
                    value={cfg.concurrency.pricingApi.parallel}
                    onChange={(e) =>
                      setCfg({
                        ...cfg,
                        concurrency: {
                          ...cfg.concurrency,
                          pricingApi: {
                            ...cfg.concurrency.pricingApi,
                            parallel: Number(e.target.value),
                          },
                        },
                      })
                    }
                    disabled={inputsLocked || saving}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor={`${formId}-conc-interval`}>Intervalo mínimo entre pedidos (ms)</Label>
                  <FieldHint>Espaçamento adicional para não sobrecarregar o serviço.</FieldHint>
                  <Input
                    id={`${formId}-conc-interval`}
                    type="number"
                    value={cfg.concurrency.pricingApi.minIntervalMs}
                    onChange={(e) =>
                      setCfg({
                        ...cfg,
                        concurrency: {
                          ...cfg.concurrency,
                          pricingApi: {
                            ...cfg.concurrency.pricingApi,
                            minIntervalMs: Number(e.target.value),
                          },
                        },
                      })
                    }
                    disabled={inputsLocked || saving}
                  />
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* ——— Price backfill batch ——— */}
        <Card>
          <CardHeader className="pb-4">
            <CardTitle className="text-lg">Processamento em lote — backfill de preços</CardTitle>
            <CardDescription>
              Limites quando o sistema percorre tenants e produtos para actualizar preços em
              segundo plano (não confundir com o agendamento Temporal abaixo).
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor={`${formId}-bf-batch`}>Tamanho do lote</Label>
              <FieldHint>Quantidade de itens processados por passagem interna.</FieldHint>
              <Input
                id={`${formId}-bf-batch`}
                type="number"
                value={cfg.concurrency.priceBackfill.batch}
                onChange={(e) =>
                  setCfg({
                    ...cfg,
                    concurrency: {
                      ...cfg.concurrency,
                      priceBackfill: {
                        ...cfg.concurrency.priceBackfill,
                        batch: Number(e.target.value),
                      },
                    },
                  })
                }
                disabled={inputsLocked || saving}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor={`${formId}-bf-maxt`}>Actualizações máximas por tenant e execução</Label>
              <FieldHint>Teto por tenant numa só corrida de backfill.</FieldHint>
              <Input
                id={`${formId}-bf-maxt`}
                type="number"
                value={cfg.concurrency.priceBackfill.maxPerTenant}
                onChange={(e) =>
                  setCfg({
                    ...cfg,
                    concurrency: {
                      ...cfg.concurrency,
                      priceBackfill: {
                        ...cfg.concurrency.priceBackfill,
                        maxPerTenant: Number(e.target.value),
                      },
                    },
                  })
                }
                disabled={inputsLocked || saving}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor={`${formId}-bf-delay`}>Pausa entre chamadas ao price-search (ms)</Label>
              <FieldHint>Durante o backfill, entre pedidos ao serviço externo.</FieldHint>
              <Input
                id={`${formId}-bf-delay`}
                type="number"
                value={cfg.concurrency.priceBackfill.interRequestDelayMs}
                onChange={(e) =>
                  setCfg({
                    ...cfg,
                    concurrency: {
                      ...cfg.concurrency,
                      priceBackfill: {
                        ...cfg.concurrency.priceBackfill,
                        interRequestDelayMs: Number(e.target.value),
                      },
                    },
                  })
                }
                disabled={inputsLocked || saving}
              />
            </div>
          </CardContent>
        </Card>

        {/* ——— Temporal scheduled ——— */}
        <Card>
          <CardHeader className="pb-4">
            <CardTitle className="text-lg">Agendamento — workflow Temporal (backfill global)</CardTitle>
            <CardDescription>
              Rodada periódica em todos os tenants. Ao alterar o cron, é necessário voltar a
              executar o job «temporal-init» no Compose para reflectir o novo horário no Temporal.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--muted)/0.35)] p-4 text-sm">
              <input
                type="checkbox"
                className="mt-0.5 h-4 w-4 rounded border-[hsl(var(--border))]"
                checked={cfg.scheduledPriceBackfill.enabled}
                onChange={(e) =>
                  setCfg({
                    ...cfg,
                    scheduledPriceBackfill: {
                      ...cfg.scheduledPriceBackfill,
                      enabled: e.target.checked,
                    },
                  })
                }
                disabled={fieldDisabled}
              />
              <span>
                <span className="font-medium text-[hsl(var(--foreground))]">
                  Activar execução agendada
                </span>
                <FieldHint className="mt-1">
                  Quando desligado, só corre backfill manual ou sob demanda — não há workflow
                  cron no Temporal.
                </FieldHint>
              </span>
            </label>

            <div className="space-y-2">
              <Label htmlFor={`${formId}-cron`}>Expressão cron</Label>
              <FieldHint>Sintaxe cron standard (minuto hora dia mês dia-da-semana); timezone do servidor.</FieldHint>
              <Input
                id={`${formId}-cron`}
                value={cfg.scheduledPriceBackfill.cronExpression}
                onChange={(e) =>
                  setCfg({
                    ...cfg,
                    scheduledPriceBackfill: {
                      ...cfg.scheduledPriceBackfill,
                      cronExpression: e.target.value,
                    },
                  })
                }
                placeholder="15 */2 * * *"
                disabled={fieldDisabled}
                autoComplete="off"
              />
            </div>

            <Separator />

            <div>
              <p className="mb-1 text-sm font-medium text-[hsl(var(--foreground))]">
                Cooldown da acção «Forçar busca» (por tenant)
              </p>
              <FieldHint className="mb-3">
                Intervalo mínimo entre disparos manuais no mesmo tenant, para evitar sobrecarga
                após sucesso ou após falha.
              </FieldHint>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor={`${formId}-cd-ok`}>Após conclusão com sucesso (segundos)</Label>
                  <Input
                    id={`${formId}-cd-ok`}
                    type="number"
                    value={cfg.scheduledPriceBackfill.manualCooldownSuccessSec}
                    onChange={(e) =>
                      setCfg({
                        ...cfg,
                        scheduledPriceBackfill: {
                          ...cfg.scheduledPriceBackfill,
                          manualCooldownSuccessSec: Number(e.target.value),
                        },
                      })
                    }
                    disabled={inputsLocked || saving}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor={`${formId}-cd-err`}>Após erro ou falha (segundos)</Label>
                  <Input
                    id={`${formId}-cd-err`}
                    type="number"
                    value={cfg.scheduledPriceBackfill.manualCooldownErrorSec}
                    onChange={(e) =>
                      setCfg({
                        ...cfg,
                        scheduledPriceBackfill: {
                          ...cfg.scheduledPriceBackfill,
                          manualCooldownErrorSec: Number(e.target.value),
                        },
                      })
                    }
                    disabled={inputsLocked || saving}
                  />
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* ——— TTL ——— */}
        <Card>
          <CardHeader className="pb-4">
            <CardTitle className="text-lg">Cache, sessão e intervalos internos</CardTitle>
            <CardDescription>
              Tempos de vida e políticas de autenticação que afectam pedidos à API e ao storage.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-6 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor={`${formId}-ttl-health`}>Intervalo entre health checks (ms)</Label>
              <FieldHint>Frequência das verificações de readiness/liveness expostas pelo backend.</FieldHint>
              <Input
                id={`${formId}-ttl-health`}
                type="number"
                value={cfg.ttl.healthcheckMs}
                onChange={(e) =>
                  setCfg({
                    ...cfg,
                    ttl: { ...cfg.ttl, healthcheckMs: Number(e.target.value) },
                  })
                }
                disabled={inputsLocked || saving}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor={`${formId}-ttl-auth`}>Cache de dados de autorização (segundos)</Label>
              <FieldHint>
                Evita ir à base em cada pedido para resolver permissões já conhecidas.
              </FieldHint>
              <Input
                id={`${formId}-ttl-auth`}
                type="number"
                value={cfg.ttl.authCacheSeconds}
                onChange={(e) =>
                  setCfg({
                    ...cfg,
                    ttl: { ...cfg.ttl, authCacheSeconds: Number(e.target.value) },
                  })
                }
                disabled={inputsLocked || saving}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor={`${formId}-ttl-r2`}>Cache da listagem de logos R2 (ms)</Label>
              <FieldHint>Tempo para reutilizar a lista de ficheiros no object storage.</FieldHint>
              <Input
                id={`${formId}-ttl-r2`}
                type="number"
                value={cfg.ttl.r2LogoListMs}
                onChange={(e) =>
                  setCfg({
                    ...cfg,
                    ttl: { ...cfg.ttl, r2LogoListMs: Number(e.target.value) },
                  })
                }
                disabled={inputsLocked || saving}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor={`${formId}-jwt`}>Validade dos tokens JWT</Label>
              <FieldHint>
                Expressão aceite pela biblioteca (ex.:{" "}
                <code className="rounded bg-[hsl(var(--muted))] px-1 text-[11px]">6h</code>,{" "}
                <code className="rounded bg-[hsl(var(--muted))] px-1 text-[11px]">7d</code>).
              </FieldHint>
              <Input
                id={`${formId}-jwt`}
                value={cfg.ttl.jwtExpiresIn}
                onChange={(e) =>
                  setCfg({
                    ...cfg,
                    ttl: { ...cfg.ttl, jwtExpiresIn: e.target.value },
                  })
                }
                disabled={inputsLocked || saving}
              />
            </div>
            <div className="flex items-end sm:col-span-2">
              <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--muted)/0.35)] p-4 text-sm sm:w-full">
                <input
                  type="checkbox"
                  className="mt-0.5 h-4 w-4 rounded border-[hsl(var(--border))]"
                  checked={cfg.ttl.allowCookieAuth}
                  onChange={(e) =>
                    setCfg({
                      ...cfg,
                      ttl: { ...cfg.ttl, allowCookieAuth: e.target.checked },
                    })
                  }
                  disabled={fieldDisabled}
                />
                <span>
                  <span className="font-medium text-[hsl(var(--foreground))]">
                    Permitir login por cookie HTTP
                  </span>
                  <FieldHint className="mt-1">
                    Quando activo, a API aceita sessão por cookie em complemento ao cabeçalho{" "}
                    <code className="text-[11px]">Authorization</code>. Avalie implicações de CSRF
                    e SameSite nas suas origens CORS.
                  </FieldHint>
                </span>
              </label>
            </div>
          </CardContent>
        </Card>

        {/* ——— Rate limits ——— */}
        <Card>
          <CardHeader className="pb-4">
            <CardTitle className="text-lg">Protecção contra abuso — limite de pedidos</CardTitle>
            <CardDescription>
              Contadores por endereço IP em janelas deslizantes; ajudam a evitar sobrecarga e
              scraping agressivo.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-8">
            <div>
              <p className="mb-3 text-sm font-medium text-[hsl(var(--foreground))]">
                Tráfego geral (API administrativa e rotas privadas)
              </p>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor={`${formId}-rl-g-win`}>Janela de contagem (ms)</Label>
                  <FieldHint>Duração da janela deslizante por IP.</FieldHint>
                  <Input
                    id={`${formId}-rl-g-win`}
                    type="number"
                    value={cfg.rateLimits.global.windowMs}
                    onChange={(e) =>
                      setCfg({
                        ...cfg,
                        rateLimits: {
                          ...cfg.rateLimits,
                          global: {
                            ...cfg.rateLimits.global,
                            windowMs: Number(e.target.value),
                          },
                        },
                      })
                    }
                    disabled={inputsLocked || saving}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor={`${formId}-rl-g-max`}>Máximo de pedidos por IP na janela</Label>
                  <FieldHint>Acima disto, novos pedidos são rejeitados até a janela avançar.</FieldHint>
                  <Input
                    id={`${formId}-rl-g-max`}
                    type="number"
                    value={cfg.rateLimits.global.max}
                    onChange={(e) =>
                      setCfg({
                        ...cfg,
                        rateLimits: {
                          ...cfg.rateLimits,
                          global: {
                            ...cfg.rateLimits.global,
                            max: Number(e.target.value),
                          },
                        },
                      })
                    }
                    disabled={inputsLocked || saving}
                  />
                </div>
              </div>
            </div>

            <Separator />

            <div>
              <p className="mb-3 text-sm font-medium text-[hsl(var(--foreground))]">
                Endpoints públicos por tenant (listagens e branding)
              </p>
              <div className="grid gap-4 sm:grid-cols-3">
                <div className="space-y-2">
                  <Label htmlFor={`${formId}-rl-p-win`}>Janela (ms)</Label>
                  <FieldHint>Mesmo conceito, aplicado ao contexto público por tenant.</FieldHint>
                  <Input
                    id={`${formId}-rl-p-win`}
                    type="number"
                    value={cfg.rateLimits.publicTenant.windowMs}
                    onChange={(e) =>
                      setCfg({
                        ...cfg,
                        rateLimits: {
                          ...cfg.rateLimits,
                          publicTenant: {
                            ...cfg.rateLimits.publicTenant,
                            windowMs: Number(e.target.value),
                          },
                        },
                      })
                    }
                    disabled={inputsLocked || saving}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor={`${formId}-rl-p-list`}>Limite — listagem de tenants</Label>
                  <FieldHint>Pedidos permitidos à API pública de listagem.</FieldHint>
                  <Input
                    id={`${formId}-rl-p-list`}
                    type="number"
                    value={cfg.rateLimits.publicTenant.listMax}
                    onChange={(e) =>
                      setCfg({
                        ...cfg,
                        rateLimits: {
                          ...cfg.rateLimits,
                          publicTenant: {
                            ...cfg.rateLimits.publicTenant,
                            listMax: Number(e.target.value),
                          },
                        },
                      })
                    }
                    disabled={inputsLocked || saving}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor={`${formId}-rl-p-brand`}>Limite — dados de branding</Label>
                  <FieldHint>Pedidos a rotas de marca/imagem pública do tenant.</FieldHint>
                  <Input
                    id={`${formId}-rl-p-brand`}
                    type="number"
                    value={cfg.rateLimits.publicTenant.brandingMax}
                    onChange={(e) =>
                      setCfg({
                        ...cfg,
                        rateLimits: {
                          ...cfg.rateLimits,
                          publicTenant: {
                            ...cfg.rateLimits.publicTenant,
                            brandingMax: Number(e.target.value),
                          },
                        },
                      })
                    }
                    disabled={inputsLocked || saving}
                  />
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* ——— Actions ——— */}
        <div className="flex flex-col gap-3 rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-5 shadow-[var(--shadow-soft)] sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-[hsl(var(--muted-foreground))]">
            Guarde para persistir na base; use recarregar para descartar alterações locais não guardadas.
          </p>
          <div className="flex flex-wrap gap-2">
            <Button onClick={() => void save()} disabled={disabled || saving}>
              {saving ? "A guardar…" : "Guardar alterações"}
            </Button>
            <Button
              type="button"
              variant="secondary"
              onClick={() => void load()}
              disabled={disabled || saving}
            >
              Recarregar do servidor
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

import type { AdminTenant } from "@/lib/admin-api";
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

export type TenantsWorkspaceProps = {
  loading: boolean;
  tenants: AdminTenant[];
  selectedTenant: AdminTenant | null;
  createSlug: string;
  setCreateSlug: (v: string) => void;
  createName: string;
  setCreateName: (v: string) => void;
  createContract: string;
  setCreateContract: (v: string) => void;
  selectedSlug: string;
  setSelectedSlug: (v: string) => void;
  newContractCode: string;
  setNewContractCode: (v: string) => void;
  boundLogin: string;
  setBoundLogin: (v: string) => void;
  xlsxFile: File | null;
  setXlsxFile: (f: File | null) => void;
  dumpFile: File | null;
  setDumpFile: (f: File | null) => void;
  birthDateFallback: string;
  setBirthDateFallback: (v: string) => void;
  createTenant: () => Promise<void>;
  alterContract: () => Promise<void>;
  uploadXlsx: () => Promise<void>;
  uploadPgDump: () => Promise<void>;
};

export function TenantsWorkspace(props: TenantsWorkspaceProps) {
  const {
    loading,
    tenants,
    selectedTenant,
    createSlug,
    setCreateSlug,
    createName,
    setCreateName,
    createContract,
    setCreateContract,
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
    createTenant,
    alterContract,
    uploadXlsx,
    uploadPgDump,
  } = props;

  return (
    <div className="space-y-8">
      <PageHeader
        title="Operações"
        description="Crie tenants, atualize contratos e importe dados por tenant (slug)."
        action={
          tenants.length > 0 ? (
            <Badge variant="secondary">{tenants.length} tenants</Badge>
          ) : null
        }
      />

      <div className="grid gap-6">
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
              Selecione um tenant e informe o novo código e o e-mail vinculado.
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
            <div className="grid gap-6 sm:grid-cols-2">
              <div className="space-y-3">
                <Label htmlFor="xlsx">Planilha (.xlsx)</Label>
                <Input
                  id="xlsx"
                  type="file"
                  accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                  disabled={loading}
                  onChange={(e) => setXlsxFile(e.target.files?.[0] ?? null)}
                />
                <Button
                  variant="secondary"
                  disabled={loading || !selectedSlug || !xlsxFile}
                  onClick={() => void uploadXlsx()}
                >
                  Importar XLSX
                </Button>
              </div>

              <div className="space-y-3">
                <Label htmlFor="dump">Dump (.sql / .sql.gz)</Label>
                <Input
                  id="dump"
                  type="file"
                  accept=".sql,.gz,application/sql,application/gzip"
                  disabled={loading}
                  onChange={(e) => setDumpFile(e.target.files?.[0] ?? null)}
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
    </div>
  );
}

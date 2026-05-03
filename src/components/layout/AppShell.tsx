import type { ReactNode } from "react";
import {
  Activity,
  Building2,
  LogOut,
  RefreshCw,
  Settings2,
} from "lucide-react";

import { LogoMark } from "@/components/logo";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";

type Tab = "tenants" | "system" | "infra";

type AppShellProps = {
  children: ReactNode;
  adminTab: Tab;
  onTabChange: (tab: Tab) => void;
  theme: string;
  onThemeChange: (theme: string) => void;
  loading: boolean;
  onRefresh: () => void;
  onDisconnect: () => void;
};

const navItems: { id: Tab; label: string; icon: typeof Building2 }[] = [
  { id: "tenants", label: "Tenants", icon: Building2 },
  { id: "system", label: "Sistema", icon: Settings2 },
  { id: "infra", label: "Infra", icon: Activity },
];

export function AppShell({
  children,
  adminTab,
  onTabChange,
  theme,
  onThemeChange,
  loading,
  onRefresh,
  onDisconnect,
}: AppShellProps) {
  return (
    <div className="flex min-h-screen flex-col md:flex-row">
      <aside className="flex w-full shrink-0 flex-col border-b border-[hsl(var(--border))] bg-[hsl(var(--card))]/80 backdrop-blur-md md:w-60 md:border-b-0 md:border-r">
        <div className="flex items-center gap-3 px-4 py-5">
          <LogoMark className="h-11 w-11 shrink-0 drop-shadow-sm" />
          <div className="min-w-0">
            <p className="text-xs font-medium uppercase tracking-wider text-[hsl(var(--muted-foreground))]">
              StoKIO
            </p>
            <p className="truncate font-semibold leading-tight text-[hsl(var(--foreground))]">
              Administração
            </p>
          </div>
        </div>

        <Separator />

        <nav className="flex flex-1 flex-col gap-0.5 p-2" aria-label="Secções">
          {navItems.map(({ id, label, icon: Icon }) => {
            const active = adminTab === id;
            return (
              <button
                key={id}
                type="button"
                onClick={() => onTabChange(id)}
                className={cn(
                  "flex items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-medium transition-colors",
                  active
                    ? "bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))] shadow-sm"
                    : "text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--muted))] hover:text-[hsl(var(--foreground))]",
                )}
              >
                <Icon className="h-4 w-4 shrink-0 opacity-90" aria-hidden />
                {label}
              </button>
            );
          })}
        </nav>

        <div className="mt-auto space-y-3 p-3">
          <div className="rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--background))]/60 p-3">
            <Label htmlFor="shell-theme" className="mb-2 block text-xs">
              Tema
            </Label>
            <select
              id="shell-theme"
              className="flex h-9 w-full rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--card))] px-2 text-sm outline-none ring-offset-[hsl(var(--background))] focus-visible:ring-2 focus-visible:ring-[hsl(var(--ring))] disabled:opacity-50"
              value={theme}
              onChange={(e) => onThemeChange(e.target.value)}
              disabled={loading}
              aria-label="Tema da interface"
            >
              <option value="abrigo">Abrigo</option>
              <option value="ocean">Ocean</option>
              <option value="slate">Slate</option>
              <option value="dark">Dark</option>
            </select>
          </div>

          <div className="flex flex-col gap-2">
            <Button
              variant="secondary"
              size="sm"
              className="w-full justify-start"
              disabled={loading}
              onClick={() => void onRefresh()}
            >
              <RefreshCw className="h-4 w-4" />
              Atualizar dados
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="w-full justify-start text-[hsl(var(--muted-foreground))]"
              onClick={onDisconnect}
            >
              <LogOut className="h-4 w-4" />
              Terminar sessão
            </Button>
          </div>
        </div>
      </aside>

      <main className="min-h-[70vh] flex-1 overflow-y-auto">
        <div className="mx-auto max-w-5xl px-4 py-8 md:px-8">{children}</div>
      </main>
    </div>
  );
}

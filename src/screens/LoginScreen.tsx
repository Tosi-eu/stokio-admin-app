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

type LoginScreenProps = {
  apiKey: string;
  onApiKeyChange: (value: string) => void;
  loading: boolean;
  authError: string | null;
  canTryLogin: boolean;
  onConnect: () => void;
};

export function LoginScreen({
  apiKey,
  onApiKeyChange,
  loading,
  authError,
  canTryLogin,
  onConnect,
}: LoginScreenProps) {
  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center px-4 py-12">
      <div
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_80%_50%_at_50%_-20%,hsl(var(--primary)/0.12),transparent)]"
        aria-hidden
      />
      <Card className="relative z-[1] w-full max-w-md border-[hsl(var(--border))] shadow-[var(--shadow-soft)]">
        <CardHeader className="space-y-4 pb-2">
          <div className="flex items-start gap-4">
            <LogoMark className="h-14 w-14 shrink-0 drop-shadow-sm" />
            <div className="min-w-0 pt-0.5">
              <CardTitle className="text-xl font-semibold tracking-tight">
                StoKIO Admin
              </CardTitle>
              <CardDescription className="mt-1.5 text-base leading-snug">
                Introduza a chave de API com permissões de administrador para
                continuar.
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-5 pt-2">
          <div className="space-y-2">
            <Label htmlFor="login-api-key">Chave de API</Label>
            <Input
              id="login-api-key"
              type="password"
              value={apiKey}
              onChange={(e) => onApiKeyChange(e.target.value)}
              disabled={loading}
              autoComplete="off"
              placeholder="••••••••••••••••"
              className="h-11"
              onKeyDown={(e) => {
                if (e.key === "Enter" && canTryLogin && !loading) {
                  e.preventDefault();
                  void onConnect();
                }
              }}
            />
            {authError ? (
              <p className="text-sm font-medium text-red-600 dark:text-red-400" role="alert">
                {authError}
              </p>
            ) : null}
          </div>
          <Button
            className="h-11 w-full text-base"
            disabled={loading || !canTryLogin}
            onClick={() => void onConnect()}
          >
            {loading ? "A ligar…" : "Continuar"}
          </Button>
          <p className="text-center text-xs text-[hsl(var(--muted-foreground))]">
            A chave corresponde a <code className="rounded bg-[hsl(var(--muted))] px-1 py-0.5 text-[11px]">X_API_KEY</code> no servidor.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

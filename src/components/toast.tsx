import { Toaster } from "sonner";

export function AppToaster() {
  return (
    <Toaster
      richColors
      closeButton
      position="bottom-right"
      toastOptions={{
        style: {
          borderRadius: 12,
          border: "1px solid hsl(var(--border))",
          boxShadow: "var(--shadow-soft)",
          background: "hsl(var(--card))",
          color: "hsl(var(--foreground))",
        },
      }}
    />
  );
}


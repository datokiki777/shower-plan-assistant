import type { ReactNode } from "react";
import { ErrorBoundary } from "./ErrorBoundary";
import { ConfirmProvider } from "@/shared/ui/ConfirmDialog";
import { ToastProvider } from "@/shared/ui/Toast";
import { PwaUpdateProvider } from "./PwaUpdateProvider";

export function AppProviders({ children }: { children: ReactNode }) {
  return (
    <ErrorBoundary>
      <ToastProvider>
        <ConfirmProvider>
          <PwaUpdateProvider>{children}</PwaUpdateProvider>
        </ConfirmProvider>
      </ToastProvider>
    </ErrorBoundary>
  );
}

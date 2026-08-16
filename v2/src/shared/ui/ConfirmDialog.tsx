import { createContext, useCallback, useContext, useState, type ReactNode } from "react";
import { Dialog } from "./Dialog";
import { Button } from "./Button";

interface ConfirmOptions {
  title?: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  danger?: boolean;
}

type ConfirmFn = (options: ConfirmOptions) => Promise<boolean>;

const ConfirmContext = createContext<ConfirmFn | null>(null);

/** Renders the single app-wide confirm dialog and exposes `confirm(...)` to
 * descendants via `useConfirm()`. Mount once near the root - see
 * app/providers. */
export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<{ options: ConfirmOptions; resolve: (value: boolean) => void } | null>(null);

  const confirm = useCallback<ConfirmFn>((options) => {
    return new Promise<boolean>((resolve) => {
      setState({ options, resolve });
    });
  }, []);

  const close = (result: boolean) => {
    state?.resolve(result);
    setState(null);
  };

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      <Dialog
        open={state !== null}
        onClose={() => close(false)}
        title={state?.options.title ?? "დაადასტურე"}
        footer={
          <>
            <Button onClick={() => close(false)}>{state?.options.cancelText ?? "გაუქმება"}</Button>
            <Button variant={state?.options.danger === false ? "primary" : "danger"} onClick={() => close(true)}>
              {state?.options.confirmText ?? "დადასტურება"}
            </Button>
          </>
        }
      >
        <p>{state?.options.message}</p>
      </Dialog>
    </ConfirmContext.Provider>
  );
}

/** `const confirm = useConfirm(); if (await confirm({ message: "..." })) { ... }` */
export function useConfirm(): ConfirmFn {
  const ctx = useContext(ConfirmContext);
  if (!ctx) throw new Error("useConfirm() must be used within a <ConfirmProvider>");
  return ctx;
}

// Re-exported so callers don't need a separate import for the options shape.
export type { ConfirmOptions };

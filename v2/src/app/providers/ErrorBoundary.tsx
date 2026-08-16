import { Component, type ErrorInfo, type ReactNode } from "react";
import { Button } from "@/shared/ui/Button";
import { Card } from "@/shared/ui/Card";

interface Props {
  children: ReactNode;
}

interface State {
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  override state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  override componentDidCatch(error: Error, info: ErrorInfo) {
    // Business data lives in IndexedDB, not component state - a render
    // crash here cannot lose or corrupt any saved data.
    console.error("Unhandled UI error:", error, info.componentStack);
  }

  override render() {
    if (!this.state.error) return this.props.children;
    return (
      <div style={{ padding: "var(--space-5)" }}>
        <Card>
          <h1 style={{ marginBottom: "var(--space-2)" }}>რაღაც შეცდომა მოხდა</h1>
          <p style={{ color: "var(--color-muted)", marginBottom: "var(--space-4)" }}>
            შენახული მონაცემები არ დაზარალებულა. სცადე გვერდის განახლება.
          </p>
          <Button variant="primary" onClick={() => window.location.reload()}>
            გვერდის განახლება
          </Button>
        </Card>
      </div>
    );
  }
}

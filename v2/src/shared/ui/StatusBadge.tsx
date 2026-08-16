import "./StatusBadge.css";

export type StatusTone = "neutral" | "brand" | "ok" | "warn" | "danger";

export interface StatusBadgeProps {
  label: string;
  tone?: StatusTone;
}

export function StatusBadge({ label, tone = "neutral" }: StatusBadgeProps) {
  return <span className={`ui-status-badge ui-status-badge--${tone}`}>{label}</span>;
}

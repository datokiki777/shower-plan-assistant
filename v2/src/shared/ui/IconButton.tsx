import type { ButtonHTMLAttributes, ReactNode } from "react";
import "./IconButton.css";

export interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  label: string; // required for accessibility since content is icon-only
  children: ReactNode;
}

export function IconButton({ label, children, className = "", type = "button", ...rest }: IconButtonProps) {
  return (
    <button type={type} aria-label={label} title={label} className={`ui-icon-button ${className}`.trim()} {...rest}>
      {children}
    </button>
  );
}

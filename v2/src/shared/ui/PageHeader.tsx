import type { ReactNode } from "react";
import "./PageHeader.css";

export interface PageHeaderProps {
  title: string;
  eyebrow?: string;
  actions?: ReactNode;
}

export function PageHeader({ title, eyebrow, actions }: PageHeaderProps) {
  return (
    <header className="ui-page-header">
      <div>
        {eyebrow && <p className="ui-page-header__eyebrow">{eyebrow}</p>}
        <h1 className="ui-page-header__title">{title}</h1>
      </div>
      {actions && <div className="ui-page-header__actions">{actions}</div>}
    </header>
  );
}

import type { ReactNode } from "react";

interface ManagementPageProps {
  actions?: ReactNode;
  children: ReactNode;
  eyebrow: string;
  title: string;
}

export function ManagementPage({ actions, children, eyebrow, title }: ManagementPageProps) {
  return (
    <section className="panel">
      <div className="panel-header">
        <div>
          <p className="eyebrow">{eyebrow}</p>
          <h2>{title}</h2>
        </div>
        {actions}
      </div>
      {children}
    </section>
  );
}

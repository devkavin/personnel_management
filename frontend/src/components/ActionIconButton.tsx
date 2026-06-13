import type { ButtonHTMLAttributes, ReactNode } from "react";

interface ActionIconButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, "children"> {
  children: ReactNode;
  label: string;
}

export function ActionIconButton({ children, label, title, type = "button", ...props }: ActionIconButtonProps) {
  return (
    <button type={type} aria-label={label} title={title ?? label} {...props}>
      {children}
    </button>
  );
}

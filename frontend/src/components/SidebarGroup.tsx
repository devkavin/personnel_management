import { ChevronDown, ChevronRight } from "lucide-react";
import { useState } from "react";
import type { ReactNode } from "react";

interface SidebarGroupItem {
  active: boolean;
  icon: ReactNode;
  label: string;
  onClick: () => void;
}

interface SidebarGroupProps {
  defaultOpen?: boolean;
  icon: ReactNode;
  isActive: boolean;
  items: SidebarGroupItem[];
  label: string;
}

export function SidebarGroup({ defaultOpen = true, icon, isActive, items, label }: SidebarGroupProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <>
      <button className={`nav-parent ${isActive ? "active" : ""}`} type="button" onClick={() => setIsOpen((current) => !current)} aria-expanded={isOpen}>
        {icon}
        <span>{label}</span>
        {isOpen ? <ChevronDown className="nav-caret" size={16} /> : <ChevronRight className="nav-caret" size={16} />}
      </button>
      {isOpen ? (
        <div className="nav-submenu">
          {items.map((item) => (
            <button className={item.active ? "active" : ""} type="button" onClick={item.onClick} key={item.label}>
              {item.icon}
              {item.label}
            </button>
          ))}
        </div>
      ) : null}
    </>
  );
}

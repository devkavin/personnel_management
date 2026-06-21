import { ChevronDown, ChevronRight } from "lucide-react";
import { useState } from "react";
import type { ReactNode } from "react";
import { Button } from "@heroui/react";

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
      <Button className={`nav-parent ${isActive ? "active" : ""}`} variant="ghost" type="button" onClick={() => setIsOpen((current) => !current)} aria-expanded={isOpen}>
        {icon}
        <span>{label}</span>
        {isOpen ? <ChevronDown className="nav-caret" size={16} /> : <ChevronRight className="nav-caret" size={16} />}
      </Button>
      {isOpen ? (
        <div className="nav-submenu">
          {items.map((item) => (
            <Button className={item.active ? "active" : ""} variant="ghost" type="button" onClick={item.onClick} key={item.label}>
              {item.icon}
              {item.label}
            </Button>
          ))}
        </div>
      ) : null}
    </>
  );
}

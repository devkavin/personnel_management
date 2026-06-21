import { Button, Checkbox, Input, Popover } from "@heroui/react";
import { ChevronDown, Search, X } from "lucide-react";
import { useMemo, useState } from "react";

interface SearchableMultiSelectOption {
  id: number;
  label: string;
  meta?: string;
}

interface SearchableMultiSelectProps {
  label: string;
  onChange: (selectedIds: number[]) => void;
  options: SearchableMultiSelectOption[];
  placeholder?: string;
  selectedIds: number[];
  selectAllLabel?: string;
}

export function SearchableMultiSelect({
  label,
  onChange,
  options,
  placeholder = "Select options",
  selectedIds,
  selectAllLabel = "Select all"
}: SearchableMultiSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState("");
  const selectedOptions = options.filter((option) => selectedIds.includes(option.id));
  const filteredOptions = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    if (!normalizedQuery) return options;
    return options.filter((option) => `${option.label} ${option.meta ?? ""}`.toLowerCase().includes(normalizedQuery));
  }, [options, query]);

  function toggleOption(optionId: number) {
    onChange(selectedIds.includes(optionId) ? selectedIds.filter((id) => id !== optionId) : [...selectedIds, optionId]);
  }

  return (
    <div className="multi-select hero-multi-select" data-ignore-dirty="true">
      <span className="multi-select-label">{label}</span>
      <Popover isOpen={isOpen} onOpenChange={setIsOpen}>
        <Popover.Trigger>
          <Button className="multi-select-trigger hero-multi-select-trigger" variant="outline" type="button" onClick={(event) => event.stopPropagation()}>
            <span>{selectedOptions.length > 0 ? `${selectedOptions.length} selected` : placeholder}</span>
            <ChevronDown size={16} />
          </Button>
        </Popover.Trigger>
        <Popover.Content className="multi-select-menu hero-multi-select-menu">
          <div className="multi-select-search">
            <Search size={16} aria-hidden="true" />
            <Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search..." />
            {query ? (
              <Button variant="ghost" size="sm" isIconOnly type="button" onPress={() => setQuery("")} aria-label="Clear multi-select search">
                <X size={15} />
              </Button>
            ) : null}
          </div>
          <div className="multi-select-menu-actions">
            <Button size="sm" variant="outline" type="button" onPress={() => onChange(options.map((option) => option.id))}>
              {selectAllLabel}
            </Button>
            <Button size="sm" variant="ghost" type="button" onPress={() => onChange([])}>
              Clear
            </Button>
          </div>
          <div className="multi-select-options">
            {filteredOptions.length > 0 ? (
              filteredOptions.map((option) => (
                <Button className={selectedIds.includes(option.id) ? "selected" : ""} variant="ghost" type="button" onPress={() => toggleOption(option.id)} key={option.id}>
                  <span>
                    <strong>{option.label}</strong>
                    {option.meta ? <small>{option.meta}</small> : null}
                  </span>
                  <Checkbox isSelected={selectedIds.includes(option.id)} aria-label={`Select ${option.label}`} />
                </Button>
              ))
            ) : (
              <div className="multi-select-empty">No matching options.</div>
            )}
          </div>
        </Popover.Content>
      </Popover>
      {selectedOptions.length > 0 ? (
        <div className="multi-select-chips">
          {selectedOptions.slice(0, 8).map((option) => (
            <span key={option.id}>
              {option.label}
              <Button variant="ghost" size="sm" isIconOnly type="button" onPress={() => toggleOption(option.id)} aria-label={`Remove ${option.label}`}>
                <X size={13} />
              </Button>
            </span>
          ))}
          {selectedOptions.length > 8 ? <span>+{selectedOptions.length - 8}</span> : null}
        </div>
      ) : null}
    </div>
  );
}

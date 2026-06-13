import { Check, ChevronDown, Search, X } from "lucide-react";
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
  const normalizedQuery = query.trim().toLowerCase();

  const filteredOptions = useMemo(() => {
    if (!normalizedQuery) return options;
    return options.filter((option) => `${option.label} ${option.meta ?? ""}`.toLowerCase().includes(normalizedQuery));
  }, [normalizedQuery, options]);

  function toggleOption(id: number) {
    if (selectedIds.includes(id)) {
      onChange(selectedIds.filter((selectedId) => selectedId !== id));
      return;
    }
    onChange([...selectedIds, id]);
  }

  function removeOption(id: number) {
    onChange(selectedIds.filter((selectedId) => selectedId !== id));
  }

  return (
    <div className="multi-select">
      <span className="multi-select-label">{label}</span>
      <button className="multi-select-trigger" type="button" onClick={() => setIsOpen((current) => !current)} aria-expanded={isOpen}>
        <span>{selectedOptions.length > 0 ? `${selectedOptions.length} selected` : placeholder}</span>
        <ChevronDown size={17} aria-hidden="true" />
      </button>

      {selectedOptions.length > 0 ? (
        <div className="multi-select-chips">
          {selectedOptions.map((option) => (
            <span key={option.id}>
              {option.label}
              <button type="button" onClick={() => removeOption(option.id)} aria-label={`Remove ${option.label}`} title="Remove">
                <X size={13} />
              </button>
            </span>
          ))}
        </div>
      ) : null}

      {isOpen ? (
        <div className="multi-select-menu">
          <label className="multi-select-search">
            <Search size={16} aria-hidden="true" />
            <input value={query} placeholder="Search" onChange={(event) => setQuery(event.target.value)} autoFocus />
          </label>
          {options.length > 0 ? (
            <div className="multi-select-menu-actions">
              <button type="button" onClick={() => onChange(options.map((option) => option.id))}>
                {selectAllLabel}
              </button>
              <button type="button" onClick={() => onChange([])}>
                Clear
              </button>
            </div>
          ) : null}
          <div className="multi-select-options">
            {filteredOptions.map((option) => {
              const isSelected = selectedIds.includes(option.id);
              return (
                <button className={isSelected ? "selected" : ""} type="button" key={option.id} onClick={() => toggleOption(option.id)}>
                  <span>
                    <strong>{option.label}</strong>
                    {option.meta ? <small>{option.meta}</small> : null}
                  </span>
                  {isSelected ? <Check size={16} aria-hidden="true" /> : null}
                </button>
              );
            })}
            {filteredOptions.length === 0 ? <div className="multi-select-empty">No matches found.</div> : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}

import { Autocomplete, Input, ListBox } from "@heroui/react";
import type { Key } from "react";

export interface SearchableSelectOption {
  label: string;
  meta?: string;
  value: string;
}

interface SearchableSelectProps {
  disabled?: boolean;
  label?: string;
  onChange: (value: string) => void;
  options: SearchableSelectOption[];
  placeholder?: string;
  value: string;
}

export function SearchableSelect({ disabled = false, label, onChange, options, placeholder = "Select option", value }: SearchableSelectProps) {
  const selectedOption = options.find((option) => option.value === value);

  function handleSelectionChange(key: Key | null) {
    onChange(key?.toString() ?? "");
  }

  return (
    <div className="searchable-select hero-select-field" data-ignore-dirty="true">
      {label ? <span className="multi-select-label">{label}</span> : null}
      <Autocomplete
        className="hero-autocomplete"
        fullWidth
        isDisabled={disabled}
        selectedKey={value || null}
        onSelectionChange={handleSelectionChange}
        onClear={() => onChange("")}
      >
        <Autocomplete.Trigger onClick={(event) => event.stopPropagation()}>
          <Autocomplete.Value>{selectedOption?.label || placeholder}</Autocomplete.Value>
          <Autocomplete.ClearButton type="button" />
          <Autocomplete.Indicator />
        </Autocomplete.Trigger>
        <Autocomplete.Popover className="hero-select-popover">
          <Autocomplete.Filter>
            <Input className="hero-autocomplete-filter" placeholder="Search..." />
          </Autocomplete.Filter>
          <ListBox items={options} className="hero-select-listbox" aria-label={label || placeholder}>
            {(option) => (
              <ListBox.Item id={option.value} textValue={option.label}>
                <span className="hero-select-option">
                  <strong>{option.label}</strong>
                  {option.meta ? <small>{option.meta}</small> : null}
                </span>
              </ListBox.Item>
            )}
          </ListBox>
        </Autocomplete.Popover>
      </Autocomplete>
    </div>
  );
}

import Select, { type SingleValue, type StylesConfig } from "react-select";

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

const selectStyles: StylesConfig<SearchableSelectOption, false> = {
  control: (base, state) => ({
    ...base,
    minHeight: 44,
    borderColor: state.isFocused ? "#0f766e" : "#cbd5e1",
    borderRadius: 8,
    backgroundColor: "#f8fafc",
    boxShadow: state.isFocused ? "0 0 0 4px rgba(15, 118, 110, 0.14)" : "none",
    ":hover": {
      borderColor: state.isFocused ? "#0f766e" : "#94a3b8"
    }
  }),
  menu: (base) => ({
    ...base,
    zIndex: 30,
    border: "1px solid #cbd5e1",
    borderRadius: 8,
    boxShadow: "0 18px 40px rgba(15, 23, 42, 0.14)",
    overflow: "hidden"
  }),
  option: (base, state) => ({
    ...base,
    color: "#1f2933",
    backgroundColor: state.isSelected ? "#ccfbf1" : state.isFocused ? "#f0fdfa" : "#ffffff",
    fontWeight: state.isSelected ? 800 : 650,
    ":active": {
      backgroundColor: "#ccfbf1"
    }
  })
};

function formatOptionLabel(option: SearchableSelectOption) {
  return (
    <span className="react-select-option">
      <strong>{option.label}</strong>
      {option.meta ? <small>{option.meta}</small> : null}
    </span>
  );
}

export function SearchableSelect({ disabled = false, label, onChange, options, placeholder = "Select option", value }: SearchableSelectProps) {
  const selectedOption = options.find((option) => option.value === value) ?? null;

  function handleChange(option: SingleValue<SearchableSelectOption>) {
    onChange(option?.value ?? "");
  }

  return (
    <label className="searchable-select">
      {label ? <span className="multi-select-label">{label}</span> : null}
      <Select<SearchableSelectOption, false>
        classNamePrefix="react-select"
        formatOptionLabel={formatOptionLabel}
        isDisabled={disabled}
        isSearchable
        onChange={handleChange}
        options={options}
        placeholder={placeholder}
        styles={selectStyles}
        value={selectedOption}
      />
    </label>
  );
}

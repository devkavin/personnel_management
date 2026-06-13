import Select, { type MultiValue, type StylesConfig } from "react-select";

interface SearchableMultiSelectOption {
  id: number;
  label: string;
  meta?: string;
}

interface SelectOption {
  id: number;
  label: string;
  meta?: string;
  value: number;
}

interface SearchableMultiSelectProps {
  label: string;
  onChange: (selectedIds: number[]) => void;
  options: SearchableMultiSelectOption[];
  placeholder?: string;
  selectedIds: number[];
  selectAllLabel?: string;
}

const multiSelectStyles: StylesConfig<SelectOption, true> = {
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
  multiValue: (base) => ({
    ...base,
    border: "1px solid #ccfbf1",
    borderRadius: 8,
    backgroundColor: "#f0fdfa"
  }),
  multiValueLabel: (base) => ({
    ...base,
    color: "#115e59",
    fontWeight: 800
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

function formatOptionLabel(option: SelectOption) {
  return (
    <span className="react-select-option">
      <strong>{option.label}</strong>
      {option.meta ? <small>{option.meta}</small> : null}
    </span>
  );
}

export function SearchableMultiSelect({
  label,
  onChange,
  options,
  placeholder = "Select options",
  selectedIds,
  selectAllLabel = "Select all"
}: SearchableMultiSelectProps) {
  const selectOptions = options.map((option) => ({ ...option, value: option.id }));
  const selectedOptions = selectOptions.filter((option) => selectedIds.includes(option.id));

  function handleChange(nextOptions: MultiValue<SelectOption>) {
    onChange(nextOptions.map((option) => option.id));
  }

  return (
    <div className="multi-select">
      <span className="multi-select-label">{label}</span>
      <Select<SelectOption, true>
        classNamePrefix="react-select"
        closeMenuOnSelect={false}
        formatOptionLabel={formatOptionLabel}
        isMulti
        isSearchable
        onChange={handleChange}
        options={selectOptions}
        placeholder={placeholder}
        styles={multiSelectStyles}
        value={selectedOptions}
      />
      {options.length > 0 ? (
        <div className="multi-select-menu-actions inline">
          <button type="button" onClick={() => onChange(options.map((option) => option.id))}>
            {selectAllLabel}
          </button>
          <button type="button" onClick={() => onChange([])}>
            Clear
          </button>
        </div>
      ) : null}
    </div>
  );
}

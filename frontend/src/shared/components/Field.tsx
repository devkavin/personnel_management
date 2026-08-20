import { FieldError, Input, Label, TextField } from "@heroui/react";

export function Field({ label, value, onChange, type = "text", required = false, error, maxLength, minLength, autoComplete }: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  required?: boolean;
  error?: string;
  maxLength?: number;
  minLength?: number;
  autoComplete?: string;
}) {
  return <TextField className="field-stack" isRequired={required} isInvalid={Boolean(error)}>
    <Label className="field-label">{label}{required ? " *" : ""}</Label>
    <Input type={type} value={value} maxLength={maxLength} minLength={minLength} autoComplete={autoComplete} onChange={(event) => onChange(event.target.value)} />
    {error ? <FieldError>{error}</FieldError> : null}
  </TextField>;
}

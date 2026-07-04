import { Input } from "@heroui/react";

export function Field({ label, value, onChange, type = "text", required = false }: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  required?: boolean;
}) {
  return <label className="field-stack"><span className="field-label">{label}{required ? " *" : ""}</span><Input type={type} value={value} required={required} onChange={(event) => onChange(event.target.value)} /></label>;
}

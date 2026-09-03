"use client";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { parseDialNumber } from "./phone-utils";

export function PhoneNumberField({ id, value, onChange, error, label = "Phone number", placeholder = "+14155550100", autoFocus }: { id?: string; value: string; onChange: (v: string) => void; error?: string; label?: string; placeholder?: string; autoFocus?: boolean }) {
  const parsed = parseDialNumber(value);
  let help: string | undefined;
  if (!value.trim()) help = "International format with country code. Spaces and dashes are fine.";
  else if (parsed.ok) help = parsed.assumedCountry ? `Will be saved as ${parsed.value} (assumed +91).` : `Will be saved as ${parsed.value}.`;
  return (
    <Field label={label} hint="E.164" htmlFor={id} error={error} help={error ? undefined : help}>
      <Input id={id} inputMode="tel" autoComplete="off" autoFocus={autoFocus} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className="font-mono text-[13px]" />
    </Field>
  );
}

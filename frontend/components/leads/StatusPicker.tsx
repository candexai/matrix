"use client";
import { useMemo, useState } from "react";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectSeparator, SelectTrigger, SelectValue } from "@/components/ui/select";

const CUSTOM = "__custom__";
const NONE = "__none__";

/**
 * Lead status control: a Select over known statuses (Zoho picklist ∪ statuses already in use)
 * with a "Custom…" escape hatch that turns into a free-text input.
 */
export function StatusPicker({ value, onChange, options, placeholder = "Select status", allowNone = true, noneLabel = "— None —" }: { value: string; onChange: (v: string) => void; options: string[]; placeholder?: string; allowNone?: boolean; noneLabel?: string }) {
  const list = useMemo(() => {
    const seen = new Set<string>();
    const out: string[] = [];
    for (const o of options) {
      const t = (o ?? "").trim();
      if (t && !seen.has(t)) {
        seen.add(t);
        out.push(t);
      }
    }
    if (value && !seen.has(value)) out.unshift(value);
    return out;
  }, [options, value]);
  const [custom, setCustom] = useState(false);

  if (!list.length || custom) {
    return (
      <div className="flex gap-2">
        <Input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} autoFocus={custom} />
        {list.length ? (
          <button type="button" onClick={() => setCustom(false)} className="shrink-0 text-xs text-muted-foreground hover:text-foreground">
            Pick from list
          </button>
        ) : null}
      </div>
    );
  }

  return (
    <Select
      value={value || (allowNone ? NONE : undefined)}
      onValueChange={(v) => {
        if (v === CUSTOM) {
          setCustom(true);
          return;
        }
        onChange(v === NONE ? "" : v);
      }}
    >
      <SelectTrigger>
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        {allowNone ? <SelectItem value={NONE}>{noneLabel}</SelectItem> : null}
        {list.map((s) => (
          <SelectItem key={s} value={s}>
            {s}
          </SelectItem>
        ))}
        <SelectSeparator />
        <SelectItem value={CUSTOM}>Custom…</SelectItem>
      </SelectContent>
    </Select>
  );
}

"use client";
import * as React from "react";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { Plus, X, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Tip } from "@/components/ui/tooltip";

/* ---------- layout ---------- */

export function SectionCard({ id, title, description, icon: Icon, children, aside }: { id: string; title: string; description?: string; icon: LucideIcon; children: ReactNode; aside?: ReactNode }) {
  return (
    <section id={id} className="scroll-mt-24 rounded-xl border border-border bg-card shadow-xs">
      <header className="flex items-start justify-between gap-4 border-b border-border px-6 py-4">
        <div className="flex items-start gap-3">
          <div className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg bg-accent-tint text-primary-hover">
            <Icon className="size-4" strokeWidth={1.8} />
          </div>
          <div>
            <h2 className="font-heading text-[19px] leading-tight">{title}</h2>
            {description ? <p className="mt-0.5 text-sm text-muted-foreground">{description}</p> : null}
          </div>
        </div>
        {aside}
      </header>
      <div className="flex flex-col gap-5 px-6 py-5">{children}</div>
    </section>
  );
}

export function Grid2({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("grid gap-5 md:grid-cols-2", className)}>{children}</div>;
}

export function SubHeading({ title, description, action }: { title: string; description?: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex items-end justify-between gap-4">
      <div>
        <h3 className="text-[14px] font-medium">{title}</h3>
        {description ? <p className="text-xs text-muted-foreground">{description}</p> : null}
      </div>
      {action}
    </div>
  );
}

export function AddButton({ onClick, children, disabled }: { onClick: () => void; children: ReactNode; disabled?: boolean }) {
  return (
    <Button type="button" variant="outline" size="sm" onClick={onClick} disabled={disabled}>
      <Plus /> {children}
    </Button>
  );
}

export function Chip({ active, onClick, children, className, title }: { active?: boolean; onClick: () => void; children: ReactNode; className?: string; title?: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      className={cn(
        "inline-flex h-7 items-center gap-1 rounded-full border px-2.5 text-xs transition-colors",
        active ? "border-primary bg-accent-tint text-primary-hover" : "border-border bg-card text-muted-foreground hover:border-zinc-400 hover:text-foreground",
        className
      )}
    >
      {children}
    </button>
  );
}

/* ---------- toggles ---------- */

export function SwitchRow({ label, help, checked, onCheckedChange, disabled, className }: { label: ReactNode; help?: ReactNode; checked: boolean; onCheckedChange: (v: boolean) => void; disabled?: boolean; className?: string }) {
  return (
    <div className={cn("flex items-start justify-between gap-6 rounded-lg border border-border px-4 py-3", checked && "border-primary/30 bg-accent-tint/20", className)}>
      <div className="min-w-0">
        <div className="text-[13px] font-medium leading-5">{label}</div>
        {help ? <p className="mt-0.5 text-xs text-muted-foreground">{help}</p> : null}
      </div>
      <Switch checked={checked} onCheckedChange={onCheckedChange} disabled={disabled} className="mt-0.5" />
    </div>
  );
}

export function CheckRow({ checked, onCheckedChange, label, description, disabled, right }: { checked: boolean; onCheckedChange: (v: boolean) => void; label: ReactNode; description?: ReactNode; disabled?: boolean; right?: ReactNode }) {
  return (
    <label className={cn("flex cursor-pointer items-start gap-3 rounded-lg border border-border px-4 py-3 transition-colors hover:bg-muted/40", checked && "border-primary/30 bg-accent-tint/20", disabled && "cursor-not-allowed opacity-60")}>
      <Checkbox checked={checked} onCheckedChange={(v) => onCheckedChange(v === true)} disabled={disabled} className="mt-0.5" />
      <div className="min-w-0 flex-1">
        <div className="text-[13px] font-medium leading-5">{label}</div>
        {description ? <p className="text-xs text-muted-foreground">{description}</p> : null}
      </div>
      {right}
    </label>
  );
}

/* ---------- numeric ---------- */

export function SliderField({ label, hint, help, value, min, max, step, onChange, format }: { label: string; hint?: string; help?: ReactNode; value: number; min: number; max: number; step: number; onChange: (v: number) => void; format?: (v: number) => string }) {
  const fmt = format ?? ((v: number) => v.toFixed(2));
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <Label hint={hint}>{label}</Label>
        <span className="rounded-md bg-muted px-1.5 py-0.5 font-mono text-xs tabular-nums">{fmt(value)}</span>
      </div>
      <Slider value={[value]} min={min} max={max} step={step} onValueChange={([v]) => onChange(v)} />
      {help ? <p className="text-xs text-muted-foreground">{help}</p> : null}
    </div>
  );
}

export function NumberField({
  label,
  hint,
  help,
  error,
  value,
  onChange,
  min,
  max,
  step = 1,
  placeholder,
  suffix,
  allowEmpty = false,
  className,
  id,
}: {
  label: ReactNode;
  hint?: string;
  help?: ReactNode;
  error?: string;
  value: number | undefined;
  onChange: (v: number | undefined) => void;
  min?: number;
  max?: number;
  step?: number;
  placeholder?: string;
  suffix?: string;
  allowEmpty?: boolean;
  className?: string;
  id?: string;
}) {
  const fmt = (v: number | undefined) => (v === undefined || Number.isNaN(v) ? "" : String(v));
  const [text, setText] = useState(fmt(value));
  const last = useRef(value);
  useEffect(() => {
    if (value !== last.current) {
      last.current = value;
      setText(fmt(value));
    }
  }, [value]);
  const push = (n: number | undefined) => {
    last.current = n;
    onChange(n);
  };
  return (
    <Field label={label} hint={hint} help={help} error={error} htmlFor={id} className={className}>
      <div className="relative">
        <Input
          id={id}
          type="number"
          inputMode="decimal"
          value={text}
          min={min}
          max={max}
          step={step}
          placeholder={placeholder}
          className={cn("tabular-nums", suffix && "pr-16", error && "border-destructive")}
          onChange={(e) => {
            const raw = e.target.value;
            setText(raw);
            if (raw.trim() === "") {
              if (allowEmpty) push(undefined);
              return;
            }
            const n = Number(raw);
            if (Number.isFinite(n)) push(n);
          }}
          onBlur={() => {
            if (text.trim() === "") {
              if (!allowEmpty) setText(fmt(value));
              return;
            }
            let n = Number(text);
            if (!Number.isFinite(n)) {
              setText(fmt(value));
              return;
            }
            if (min !== undefined && n < min) n = min;
            if (max !== undefined && n > max) n = max;
            if (n !== value) push(n);
            setText(fmt(n));
          }}
        />
        {suffix ? <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-xs text-muted-foreground">{suffix}</span> : null}
      </div>
    </Field>
  );
}

/* ---------- lists ---------- */

export function TagInput({ value, onChange, placeholder, mono, ariaLabel, className }: { value: string[]; onChange: (v: string[]) => void; placeholder?: string; mono?: boolean; ariaLabel?: string; className?: string }) {
  const [text, setText] = useState("");
  const add = (raw: string) => {
    const parts = raw
      .split(/[,\n]/)
      .map((s) => s.trim())
      .filter(Boolean);
    if (!parts.length) {
      setText("");
      return;
    }
    onChange(Array.from(new Set([...value, ...parts])));
    setText("");
  };
  return (
    <div className={cn("flex min-h-9 flex-wrap items-center gap-1.5 rounded-md border border-input bg-card px-2 py-1.5 shadow-xs transition-colors focus-within:border-primary focus-within:ring-2 focus-within:ring-ring/40", className)}>
      {value.map((t) => (
        <span key={t} className={cn("inline-flex items-center gap-1 rounded-md bg-muted px-2 py-0.5 text-xs", mono && "font-mono")}>
          {t}
          <button type="button" onClick={() => onChange(value.filter((x) => x !== t))} className="text-muted-foreground hover:text-foreground" aria-label={`Remove ${t}`}>
            <X className="size-3" />
          </button>
        </span>
      ))}
      <input
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === ",") {
            e.preventDefault();
            add(text);
          } else if (e.key === "Backspace" && !text && value.length) {
            onChange(value.slice(0, -1));
          }
        }}
        onBlur={() => (text.trim() ? add(text) : undefined)}
        onPaste={(e) => {
          const t = e.clipboardData.getData("text");
          if (/[,\n]/.test(t)) {
            e.preventDefault();
            add(t);
          }
        }}
        placeholder={value.length ? "" : placeholder}
        aria-label={ariaLabel}
        className={cn("min-w-[140px] flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground", mono && "font-mono text-[13px]")}
      />
    </div>
  );
}

interface KVRow {
  id: number;
  k: string;
  v: string;
}
let kvSeq = 0;
const toRows = (value: Record<string, string>): KVRow[] => Object.entries(value).map(([k, v]) => ({ id: ++kvSeq, k, v: String(v ?? "") }));

export function KeyValueEditor({
  value,
  onChange,
  keyPlaceholder = "key",
  valuePlaceholder = "value",
  addLabel = "Add variable",
  emptyText = "No variables yet.",
  disabled,
}: {
  value: Record<string, string>;
  onChange: (v: Record<string, string>) => void;
  keyPlaceholder?: string;
  valuePlaceholder?: string;
  addLabel?: string;
  emptyText?: string;
  disabled?: boolean;
}) {
  const [rows, setRows] = useState<KVRow[]>(() => toRows(value));
  const emitted = useRef(JSON.stringify(value));
  useEffect(() => {
    const incoming = JSON.stringify(value);
    if (incoming !== emitted.current) {
      emitted.current = incoming;
      setRows(toRows(value));
    }
  }, [value]);
  const commit = (next: KVRow[]) => {
    setRows(next);
    const obj: Record<string, string> = {};
    for (const r of next) {
      const k = r.k.trim();
      if (k) obj[k] = r.v;
    }
    emitted.current = JSON.stringify(obj);
    onChange(obj);
  };
  return (
    <div className="flex flex-col gap-2">
      {rows.length === 0 ? <p className="text-xs text-muted-foreground">{emptyText}</p> : null}
      {rows.map((r) => (
        <div key={r.id} className="grid grid-cols-[1fr_1.4fr_auto] items-center gap-2">
          <Input value={r.k} disabled={disabled} onChange={(e) => commit(rows.map((x) => (x.id === r.id ? { ...x, k: e.target.value } : x)))} placeholder={keyPlaceholder} className="font-mono text-[13px]" />
          <Input value={r.v} disabled={disabled} onChange={(e) => commit(rows.map((x) => (x.id === r.id ? { ...x, v: e.target.value } : x)))} placeholder={valuePlaceholder} />
          <Button type="button" variant="ghost" size="icon" disabled={disabled} onClick={() => commit(rows.filter((x) => x.id !== r.id))} aria-label="Remove">
            <X />
          </Button>
        </div>
      ))}
      <div>
        <AddButton disabled={disabled} onClick={() => commit([...rows, { id: ++kvSeq, k: "", v: "" }])}>
          {addLabel}
        </AddButton>
      </div>
    </div>
  );
}

/* ---------- radio cards ---------- */

export interface RadioCardOption<T extends string> {
  value: T;
  label: string;
  description?: string;
  badges?: ReactNode;
  disabledReason?: string;
}

export function RadioCards<T extends string>({ options, value, onChange, columns = 2 }: { options: RadioCardOption<T>[]; value: T; onChange: (v: T) => void; columns?: 1 | 2 | 3 }) {
  return (
    <div className={cn("grid gap-3", columns === 2 && "sm:grid-cols-2", columns === 3 && "sm:grid-cols-3")} role="radiogroup">
      {options.map((o) => {
        const selected = o.value === value;
        const disabled = Boolean(o.disabledReason);
        const card = (
          <button
            type="button"
            role="radio"
            aria-checked={selected}
            aria-disabled={disabled}
            onClick={() => (!disabled ? onChange(o.value) : undefined)}
            className={cn(
              "flex h-full w-full flex-col items-start gap-1.5 rounded-lg border px-4 py-3 text-left transition-colors",
              selected ? "border-primary bg-accent-tint/30 ring-1 ring-primary/40" : "border-border hover:bg-muted/40",
              disabled && "cursor-not-allowed opacity-50 hover:bg-transparent"
            )}
          >
            <div className="flex w-full items-center gap-2">
              <span className={cn("flex size-4 shrink-0 items-center justify-center rounded-full border", selected ? "border-primary" : "border-zinc-400")}>{selected ? <span className="size-2 rounded-full bg-primary" /> : null}</span>
              <span className="text-[13.5px] font-medium">{o.label}</span>
            </div>
            {o.description ? <p className="pl-6 text-xs text-muted-foreground">{o.description}</p> : null}
            {o.badges ? <div className="flex flex-wrap gap-1 pl-6">{o.badges}</div> : null}
          </button>
        );
        return disabled ? (
          <Tip key={o.value} label={o.disabledReason}>
            <div className="w-full">{card}</div>
          </Tip>
        ) : (
          <React.Fragment key={o.value}>{card}</React.Fragment>
        );
      })}
    </div>
  );
}

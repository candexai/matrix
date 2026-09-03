"use client";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Tip } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { categoryLabel, formatScore, riskColor, riskLabel, riskPct, sentimentMeta, tagColor, tagTint } from "../insightColors";

/** Solid colour dot that carries a tag's identity. */
export function TagDot({ color, className }: { color?: number | null; className?: string }) {
  return <span className={cn("inline-block size-2 shrink-0 rounded-full", className)} style={{ background: tagColor(color) }} aria-hidden />;
}

/**
 * Tag chip: colour dot + label. Text stays in the foreground ink; the dot carries identity so
 * chips read the same in light and dark themes. Renders as a link, button or plain span.
 */
export function TagChip({
  label,
  color,
  size = "sm",
  href,
  onClick,
  active,
  className,
  title,
}: {
  label: string;
  color?: number | null;
  size?: "xs" | "sm" | "md";
  href?: string;
  onClick?: () => void;
  active?: boolean;
  className?: string;
  title?: string;
}) {
  const cls = cn(
    "inline-flex max-w-full items-center rounded-full border font-medium whitespace-nowrap transition-colors",
    size === "xs" && "h-[18px] gap-1 px-1.5 text-[10.5px]",
    size === "sm" && "h-[22px] gap-1.5 px-2 text-[11.5px]",
    size === "md" && "h-7 gap-2 px-2.5 text-[13px]",
    (href || onClick) && "hover:brightness-95 dark:hover:brightness-125",
    active && "ring-2 ring-primary/40",
    className
  );
  const style = { borderColor: tagTint(color, 40), background: tagTint(color, active ? 22 : 12), color: "var(--foreground)" };
  const inner = (
    <>
      <TagDot color={color} className={size === "xs" ? "size-1.5" : "size-2"} />
      <span className="truncate">{label}</span>
    </>
  );
  if (href) {
    return (
      <Link href={href} className={cls} style={style} title={title ?? label}>
        {inner}
      </Link>
    );
  }
  if (onClick) {
    return (
      <button type="button" onClick={onClick} className={cls} style={style} title={title ?? label}>
        {inner}
      </button>
    );
  }
  return (
    <span className={cls} style={style} title={title ?? label}>
      {inner}
    </span>
  );
}

/** Tiny uppercase category label (outcome / sentiment / objection …). */
export function CategoryChip({ category, className }: { category?: string | null; className?: string }) {
  return <span className={cn("inline-flex shrink-0 items-center rounded-[4px] bg-muted px-1.5 py-px text-[10px] font-medium uppercase tracking-[0.06em] text-muted-foreground", className)}>{categoryLabel(category)}</span>;
}

export function SentimentDot({ sentiment, className }: { sentiment?: string | null; className?: string }) {
  const m = sentimentMeta(sentiment);
  return <span className={cn("inline-block size-2 shrink-0 rounded-full", className)} style={{ background: m.color }} aria-label={`${m.label} sentiment`} role="img" />;
}

export function SentimentBadge({ sentiment, score, className }: { sentiment?: string | null; score?: number | null; className?: string }) {
  const m = sentimentMeta(sentiment);
  return (
    <Badge variant={m.variant} className={className}>
      <span className="size-1.5 rounded-full" style={{ background: "currentColor" }} aria-hidden />
      {m.label}
      {score !== undefined && score !== null ? <span className="tabular-nums opacity-80">{formatScore(score)}</span> : null}
    </Badge>
  );
}

/** Bidirectional −1…1 meter: fills from the centre towards the sentiment's pole. */
export function SentimentMeter({ score, className }: { score?: number | null; className?: string }) {
  const s = Math.max(-1, Math.min(1, score ?? 0));
  const half = Math.abs(s) * 50;
  const color = s > 0.05 ? "var(--success)" : s < -0.05 ? "var(--destructive)" : "var(--muted-foreground)";
  return (
    <Tip label={`Sentiment score ${formatScore(s)}`}>
      <div className={cn("relative h-1.5 w-full overflow-hidden rounded-full bg-muted", className)} role="img" aria-label={`Sentiment score ${formatScore(s)}`}>
        <span className="absolute inset-y-0 left-1/2 w-px bg-border" aria-hidden />
        <span className="absolute inset-y-0 rounded-full" style={{ background: color, left: s >= 0 ? "50%" : `${50 - half}%`, width: `${half}%` }} />
      </div>
    </Tip>
  );
}

/** Loss-risk meter (0…1), coloured by bucket green → red. */
export function RiskMeter({ risk, showValue, className, trackClassName }: { risk?: number | null; showValue?: boolean; className?: string; trackClassName?: string }) {
  const known = risk !== null && risk !== undefined && Number.isFinite(risk);
  const pct = riskPct(risk);
  const label = known ? `${riskLabel(risk)} loss risk · ${pct}%` : "Loss risk unknown";
  return (
    <Tip label={label}>
      <div className={cn("flex items-center gap-2", className)}>
        <div className={cn("h-1.5 w-10 overflow-hidden rounded-full bg-muted", trackClassName)} role="img" aria-label={label}>
          {known ? <div className="h-full rounded-full transition-[width] duration-300" style={{ width: `${Math.max(pct, 3)}%`, background: riskColor(risk) }} /> : null}
        </div>
        {showValue ? <span className="text-[12px] tabular-nums text-muted-foreground">{known ? `${pct}%` : "—"}</span> : null}
      </div>
    </Tip>
  );
}

/** Minimal SVG sparkline; `stretch` fills the container width. */
export function Spark({ values, color, width = 56, height = 18, stretch, className }: { values: number[]; color: string; width?: number; height?: number; stretch?: boolean; className?: string }) {
  const n = values.length;
  if (n < 2) return null;
  const max = Math.max(1, ...values);
  const pad = 2;
  const pts = values.map((v, i) => `${((i / (n - 1)) * width).toFixed(1)},${(height - pad - (v / max) * (height - pad * 2)).toFixed(1)}`).join(" ");
  const flat = values.every((v) => v === 0);
  return (
    <svg width={stretch ? "100%" : width} height={height} viewBox={`0 0 ${width} ${height}`} preserveAspectRatio={stretch ? "none" : "xMidYMid meet"} className={cn("shrink-0 overflow-visible", className)} aria-hidden>
      <polyline points={pts} fill="none" stroke={flat ? "var(--border)" : color} strokeWidth={1.5} strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

/** Small uppercase label + value block used in stat strips. */
export function Stat({ label, children, className }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={cn("min-w-0", className)}>
      <div className="text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground">{label}</div>
      <div className="mt-1 min-w-0 text-[13.5px]">{children}</div>
    </div>
  );
}

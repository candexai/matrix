"use client";
import { useState } from "react";
import Link from "next/link";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { ArrowRight, Bot, ExternalLink, GitMerge, Pencil, PhoneCall, Trash2, UserRound, X } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useDeleteInsightTag, useMergeInsightTags, useRenameInsightTag } from "@/hooks/api";
import type { InsightsDashboard, InsightsTaxonomyEntry } from "@/lib/types";
import { cn, formatNumber, relativeTime } from "@/lib/utils";
import { CATEGORY_META, INSIGHT_CATEGORIES, formatScore, riskPct, tagColor } from "../insightColors";
import { CategoryChip, RiskMeter, Spark, Stat, TagDot } from "./primitives";
import { useTagSeries } from "./TaxonomyPanel";

const fmtDate = (d: string) => new Date(d).toLocaleDateString(undefined, { day: "numeric", month: "short" });

function SectionLabel({ children, right }: { children: React.ReactNode; right?: React.ReactNode }) {
  return (
    <div className="mb-2 flex items-center justify-between gap-3">
      <h4 className="text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground">{children}</h4>
      {right}
    </div>
  );
}

function SheetBody({ tag, taxonomy, trends, days, onClose }: { tag: InsightsTaxonomyEntry; taxonomy: InsightsTaxonomyEntry[]; trends: InsightsDashboard["trends"]; days: number; onClose: () => void }) {
  const rename = useRenameInsightTag();
  const merge = useMergeInsightTags();
  const del = useDeleteInsightTag();
  const series = useTagSeries(trends).get(tag.key);

  const [mode, setMode] = useState<"idle" | "rename" | "merge">("idle");
  const [label, setLabel] = useState(tag.label);
  const [description, setDescription] = useState(tag.description ?? "");
  const [mergeInto, setMergeInto] = useState("");
  const [mergeLabel, setMergeLabel] = useState("");
  const [mergeReason, setMergeReason] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);

  const others = taxonomy.filter((t) => t.key !== tag.key);
  const target = others.find((t) => t.key === mergeInto);
  const descriptionDirty = description.trim() !== (tag.description ?? "").trim();

  return (
    <>
      <header className="shrink-0 border-b border-border px-6 py-5">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="flex items-center gap-2.5">
              <TagDot color={tag.color} className="size-3" />
              <DialogPrimitive.Title className="truncate font-heading text-[22px] leading-tight">{tag.label}</DialogPrimitive.Title>
              <CategoryChip category={tag.category} />
            </div>
            <DialogPrimitive.Description className="mt-1 text-[12.5px] text-muted-foreground">
              <span className="font-mono">{tag.key}</span> · first seen {fmtDate(tag.firstSeenAt)}
              {tag.lastSeenAt ? ` · last seen ${relativeTime(tag.lastSeenAt)}` : ""}
            </DialogPrimitive.Description>
          </div>
          <DialogPrimitive.Close className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground" aria-label="Close">
            <X className="size-4" />
          </DialogPrimitive.Close>
        </div>

        <dl className="mt-4 grid grid-cols-4 gap-4">
          <Stat label="Calls">
            <span className="font-heading text-[22px] leading-none tabular-nums">{formatNumber(tag.count)}</span>
            <span className="ml-1 text-[11px] text-muted-foreground">of {formatNumber(tag.countAllTime)} all time</span>
          </Stat>
          <Stat label="Share">
            <span className="font-heading text-[22px] leading-none tabular-nums">{tag.share}%</span>
          </Stat>
          <Stat label="Avg loss risk">
            <div className="flex items-center gap-2 pt-1">
              <RiskMeter risk={tag.avgLossRisk} trackClassName="w-14" />
              <span className="text-[13px] tabular-nums">{tag.avgLossRisk === null ? "—" : `${riskPct(tag.avgLossRisk)}%`}</span>
            </div>
          </Stat>
          <Stat label="Avg sentiment">
            <span className={cn("font-heading text-[22px] leading-none tabular-nums", tag.avgSentiment !== null && tag.avgSentiment > 0.25 && "text-success", tag.avgSentiment !== null && tag.avgSentiment < -0.25 && "text-destructive")}>
              {formatScore(tag.avgSentiment)}
            </span>
          </Stat>
        </dl>

        {series && series.some((v) => v > 0) ? (
          <div className="mt-4 rounded-lg border border-border bg-muted/30 px-3 py-2">
            <div className="mb-1 flex items-center justify-between text-[11px] text-muted-foreground">
              <span>Calls per day · last {days} days</span>
              <span className="tabular-nums">peak {Math.max(...series)}</span>
            </div>
            <Spark values={series} color={tagColor(tag.color)} height={36} width={200} stretch />
          </div>
        ) : null}

        <div className="mt-4 flex flex-wrap items-center gap-2">
          <Link href={`/conversations?tag=${encodeURIComponent(tag.key)}`} className={buttonVariants({ variant: "outline", size: "sm" })}>
            <PhoneCall /> View calls
          </Link>
          <Button variant={mode === "rename" ? "soft" : "ghost"} size="sm" onClick={() => setMode(mode === "rename" ? "idle" : "rename")}>
            <Pencil /> Rename
          </Button>
          <Button variant={mode === "merge" ? "soft" : "ghost"} size="sm" onClick={() => setMode(mode === "merge" ? "idle" : "merge")} disabled={!others.length}>
            <GitMerge /> Merge into…
          </Button>
          <Button variant="ghost" size="sm" className="ml-auto text-destructive hover:bg-destructive/10" onClick={() => setConfirmDelete(true)}>
            <Trash2 /> Delete
          </Button>
        </div>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
        <div className="space-y-6">
          {mode === "rename" ? (
            <form
              className="space-y-3 rounded-lg border border-primary/30 bg-accent-tint/40 p-4"
              onSubmit={(e) => {
                e.preventDefault();
                if (!label.trim() || label.trim() === tag.label) return setMode("idle");
                rename.mutate({ key: tag.key, label: label.trim() }, { onSuccess: () => setMode("idle") });
              }}
            >
              <Field label="New label" help="2–4 words in Title Case. Every tagged call is updated.">
                <Input value={label} onChange={(e) => setLabel(e.target.value)} maxLength={48} autoFocus />
              </Field>
              <div className="flex justify-end gap-2">
                <Button type="button" variant="ghost" size="sm" onClick={() => setMode("idle")}>
                  Cancel
                </Button>
                <Button type="submit" size="sm" loading={rename.isPending} disabled={!label.trim()}>
                  Save label
                </Button>
              </div>
            </form>
          ) : null}

          {mode === "merge" ? (
            <form
              className="space-y-3 rounded-lg border border-primary/30 bg-accent-tint/40 p-4"
              onSubmit={(e) => {
                e.preventDefault();
                if (!target) return;
                merge.mutate({ from: tag.key, into: target.key, label: mergeLabel.trim() || undefined, reason: mergeReason.trim() || undefined }, { onSuccess: onClose });
              }}
            >
              <Field label="Merge into" help={target ? `“${tag.label}” is retired; its ${formatNumber(tag.countAllTime)} calls are re-tagged as “${mergeLabel.trim() || target.label}” (${formatNumber(target.countAllTime + tag.countAllTime)} total).` : "Pick the tag that means the same thing for the business."}>
                <Select value={mergeInto} onValueChange={setMergeInto}>
                  <SelectTrigger aria-label="Merge target">
                    <SelectValue placeholder="Choose a tag" />
                  </SelectTrigger>
                  <SelectContent>
                    {others.map((t) => (
                      <SelectItem key={t.key} value={t.key}>
                        <span className="inline-flex items-center gap-2">
                          <TagDot color={t.color} /> {t.label}
                          <span className="text-xs text-muted-foreground">· {formatNumber(t.countAllTime)}</span>
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="New label" hint="optional">
                  <Input value={mergeLabel} onChange={(e) => setMergeLabel(e.target.value)} placeholder={target?.label ?? "Keep target label"} maxLength={48} />
                </Field>
                <Field label="Reason" hint="optional">
                  <Input value={mergeReason} onChange={(e) => setMergeReason(e.target.value)} placeholder="Same meaning for sales" maxLength={200} />
                </Field>
              </div>
              <div className="flex justify-end gap-2">
                <Button type="button" variant="ghost" size="sm" onClick={() => setMode("idle")}>
                  Cancel
                </Button>
                <Button type="submit" size="sm" loading={merge.isPending} disabled={!target}>
                  <GitMerge /> Merge {tag.label} <ArrowRight /> {target?.label ?? "…"}
                </Button>
              </div>
            </form>
          ) : null}

          <section>
            <SectionLabel
              right={
                descriptionDirty ? (
                  <Button size="xs" variant="soft" loading={rename.isPending} onClick={() => rename.mutate({ key: tag.key, description: description.trim() })}>
                    Save
                  </Button>
                ) : null
              }
            >
              Description
            </SectionLabel>
            <Textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="What does this tag mean for the business?" maxLength={200} className="min-h-[64px] text-[13.5px]" />
            <div className="mt-3 grid grid-cols-[auto_1fr] items-center gap-3">
              <span className="text-[12.5px] text-muted-foreground">Category</span>
              <Select value={tag.category} onValueChange={(v) => rename.mutate({ key: tag.key, category: v })}>
                <SelectTrigger className="h-8 w-[200px] text-[13px]" aria-label="Category">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {INSIGHT_CATEGORIES.map((c) => (
                    <SelectItem key={c} value={c} description={CATEGORY_META[c].hint}>
                      {CATEGORY_META[c].label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </section>

          <section>
            <SectionLabel>Examples</SectionLabel>
            {tag.examples.length ? (
              <ul className="divide-y divide-border rounded-lg border border-border">
                {tag.examples.map((ex) => (
                  <li key={`${ex.conversationId}-${ex.at}`} className="px-3.5 py-3">
                    <div className="flex items-center justify-between gap-3">
                      <span className="truncate text-[13.5px] font-medium">{ex.leadName || "Unknown caller"}</span>
                      <span className="shrink-0 text-[11px] text-muted-foreground">{relativeTime(ex.at)}</span>
                    </div>
                    {ex.evidence ? <p className="mt-1 text-[13px] italic leading-relaxed text-muted-foreground">“{ex.evidence}”</p> : null}
                    <Link href={`/conversations?id=${encodeURIComponent(ex.conversationId)}`} className="mt-1.5 inline-flex items-center gap-1 text-[12.5px] text-primary-hover hover:underline">
                      Open call <ExternalLink className="size-3" />
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-[13px] text-muted-foreground">No example quotes stored yet.</p>
            )}
          </section>

          <section>
            <SectionLabel>Merge history</SectionLabel>
            {tag.mergedFrom.length ? (
              <ol className="space-y-2.5">
                {[...tag.mergedFrom].reverse().map((m) => (
                  <li key={`${m.key}-${m.at}`} className="flex items-start gap-2.5 text-[13px]">
                    <span className="mt-1 flex size-5 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground">{m.by === "llm" ? <Bot className="size-3" /> : <UserRound className="size-3" />}</span>
                    <div className="min-w-0">
                      <span className="font-medium">{m.label}</span> <span className="tabular-nums text-muted-foreground">({formatNumber(m.count)})</span> merged in on {fmtDate(m.at)} by {m.by === "llm" ? "AI" : "you"}
                      {m.reason ? <span className="text-muted-foreground"> — {m.reason}</span> : null}
                    </div>
                  </li>
                ))}
              </ol>
            ) : (
              <p className="text-[13px] text-muted-foreground">Nothing has been merged into this tag.</p>
            )}
          </section>
        </div>
      </div>

      <Dialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <DialogContent size="sm">
          <DialogHeader>
            <DialogTitle>Delete “{tag.label}”?</DialogTitle>
            <DialogDescription>
              The tag is removed from {formatNumber(tag.countAllTime)} call{tag.countAllTime === 1 ? "" : "s"} and frees a taxonomy slot. If it overlaps another tag, merging keeps the history instead.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setConfirmDelete(false)} disabled={del.isPending}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              loading={del.isPending}
              onClick={() =>
                del.mutate(tag.key, {
                  onSuccess: () => {
                    setConfirmDelete(false);
                    onClose();
                  },
                })
              }
            >
              <Trash2 /> Delete tag
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

/** Right-side sheet with the full detail + management actions for one taxonomy tag. */
export function TagDetailSheet({ tag, open, onOpenChange, taxonomy, trends, days }: { tag: InsightsTaxonomyEntry | null; open: boolean; onOpenChange: (open: boolean) => void; taxonomy: InsightsTaxonomyEntry[]; trends: InsightsDashboard["trends"]; days: number }) {
  return (
    <DialogPrimitive.Root open={open && Boolean(tag)} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/30 backdrop-blur-[1px] animate-fade-in" />
        <DialogPrimitive.Content className="insight-sheet fixed inset-y-0 right-0 z-50 flex w-full max-w-[560px] flex-col border-l border-border bg-card shadow-2xl outline-none">
          {tag ? <SheetBody key={tag.key} tag={tag} taxonomy={taxonomy} trends={trends} days={days} onClose={() => onOpenChange(false)} /> : null}
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}

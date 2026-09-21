"use client";
import { useId, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Bot, Check, ChevronDown, ChevronUp, CircleAlert, Copy, ExternalLink, Globe, ListFilter, Mail, MapPin, MonitorSmartphone, Phone, Smartphone, Sparkles, Table2, UserPlus, type LucideIcon } from "lucide-react";
import { SentimentDot } from "@/components/analytics/insights/primitives";
import { statusVariant } from "@/components/leads/leadUtils";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Tip } from "@/components/ui/tooltip";
import { useConversationProfile } from "@/hooks/api";
import { errorMessage } from "@/lib/api";
import type { Conversation, ConversationProfile, ConversationProfileCaptured, ConversationProfileHistoryItem, ConversationProfileLead } from "@/lib/types";
import { cn, formatDateTime, formatDuration, formatNumber, initials, relativeTime, titleCase } from "@/lib/utils";
import { copyText, formatDisplayName, formatPhone, outcomeMeta, profileHasName, statusMeta } from "./helpers";
import { SaveAsLeadDialog } from "./SaveAsLeadDialog";

const SOURCE_LABELS: Record<ConversationProfileLead["source"], string> = { zoho: "Zoho CRM", manual: "Manual", csv: "CSV import" };
const CRM_FIELDS_VISIBLE = 6;
const CAPTURED_VISIBLE = 8;

// ---------------------------------------------------------------- building blocks

function SectionLabel({ children, right }: { children: React.ReactNode; right?: React.ReactNode }) {
  return (
    <div className="mb-2.5 flex items-center justify-between gap-3">
      <h4 className="text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground">{children}</h4>
      {right}
    </div>
  );
}

function CopyButton({ value, label }: { value: string; label: string }) {
  return (
    <Tip label="Copy">
      <button type="button" onClick={() => copyText(value)} aria-label={`Copy ${label}`} className="shrink-0 rounded p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40">
        <Copy className="size-3.5" strokeWidth={1.8} />
      </button>
    </Tip>
  );
}

function ShowAllToggle({ expanded, total, onToggle, controls }: { expanded: boolean; total: number; onToggle: () => void; controls: string }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-expanded={expanded}
      aria-controls={controls}
      className="mt-2.5 inline-flex items-center gap-1 rounded text-[12.5px] font-medium text-primary-hover hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
    >
      {expanded ? <ChevronUp className="size-3.5" /> : <ChevronDown className="size-3.5" />}
      {expanded ? "Show less" : `Show all (${total})`}
    </button>
  );
}

// ---------------------------------------------------------------- 1. identity

function Identity({ p }: { p: ConversationProfile }) {
  const lead = p.lead;
  const name = formatDisplayName(p.displayName.trim() || (p.phone ?? "") || "Unknown caller");
  const named = profileHasName(p);
  const FallbackIcon = p.kind === "web" ? MonitorSmartphone : Phone;
  const role = lead ? [lead.title, lead.company].filter(Boolean).join(" · ") : "";
  const location = lead ? [lead.city, lead.state, lead.country].filter(Boolean).join(", ") : "";
  const repeat = p.kind !== "lead" && p.stats.totalCalls > 1;

  return (
    <div className="flex items-start gap-3.5">
      <div className="flex size-14 shrink-0 items-center justify-center rounded-full bg-accent-tint font-heading text-[19px] text-primary-hover" aria-hidden>
        {named ? initials(name) : <FallbackIcon className="size-6" strokeWidth={1.6} />}
      </div>
      <div className="min-w-0 flex-1 pt-0.5">
        <h3 className="line-clamp-2 break-words font-heading text-[20px] leading-tight" title={name}>
          {name}
        </h3>
        {lead ? (
          role ? (
            <p className="mt-0.5 line-clamp-2 break-words text-[13px] text-muted-foreground">{role}</p>
          ) : null
        ) : (
          <p className="mt-0.5 text-[13px] text-muted-foreground">{p.kind === "web" ? "Browser test call" : "Not in My Leads yet"}</p>
        )}
        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          {lead ? (
            <>
              <Badge variant={statusVariant(lead.leadStatus)} className="max-w-full">
                <span className="truncate">{lead.leadStatus || "No status"}</span>
              </Badge>
              <Badge variant={lead.source === "zoho" ? "soft" : "outline"}>{SOURCE_LABELS[lead.source] ?? titleCase(lead.source)}</Badge>
              {lead.rating ? (
                <Badge variant="outline" className="max-w-full">
                  <span className="truncate">{lead.rating}</span>
                </Badge>
              ) : null}
            </>
          ) : p.kind === "caller" ? (
            <Badge variant="outline">Unknown caller</Badge>
          ) : (
            <Badge variant="outline">Web</Badge>
          )}
          {repeat ? <Badge variant="info">Repeat caller</Badge> : null}
        </div>
        {location ? (
          <p className="mt-2 flex items-start gap-1.5 text-[12.5px] text-muted-foreground">
            <MapPin className="mt-0.5 size-3.5 shrink-0" strokeWidth={1.8} />
            <span className="min-w-0 break-words">{location}</span>
          </p>
        ) : null}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- 2. actions

/** "All calls" toggles the page's existing `leadId` URL filter (read by ConversationsPage). */
function useLeadCallsFilter(leadId?: string) {
  const sp = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const active = Boolean(leadId) && sp.get("leadId") === leadId;
  const toggle = () => {
    if (!leadId) return;
    const next = new URLSearchParams(sp.toString());
    if (active) next.delete("leadId");
    else next.set("leadId", leadId);
    const qs = next.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  };
  return { active, toggle };
}

function Actions({ p, onSave }: { p: ConversationProfile; onSave: () => void }) {
  const filter = useLeadCallsFilter(p.lead?._id);
  if (p.lead) {
    return (
      <div className="flex flex-wrap items-center gap-2">
        <Link href={`/leads?open=${encodeURIComponent(p.lead._id)}`} className={buttonVariants({ variant: "outline", size: "sm" })}>
          <ExternalLink /> Open lead
        </Link>
        <Tip label={filter.active ? "Showing only this lead's calls — click to clear" : "Filter the list to this lead's calls"}>
          <Button variant={filter.active ? "soft" : "outline"} size="sm" onClick={filter.toggle} aria-pressed={filter.active}>
            <ListFilter /> All calls
            {p.stats.totalCalls > 0 ? <span className="tabular-nums text-muted-foreground">{formatNumber(p.stats.totalCalls)}</span> : null}
          </Button>
        </Tip>
      </div>
    );
  }
  return (
    <div>
      <Button size="sm" onClick={onSave}>
        <UserPlus /> Save as lead
      </Button>
      <p className="mt-2 text-[12.5px] leading-relaxed text-muted-foreground">
        {p.phone ? "Adds this caller to My Leads and links every call from this number." : "Adds this caller to My Leads and links this call."}
      </p>
    </div>
  );
}

// ---------------------------------------------------------------- 3. contact

function ContactRow({ icon: Icon, label, copyValue, children }: { icon: LucideIcon; label: string; copyValue: string; children: React.ReactNode }) {
  return (
    <li className="flex min-w-0 items-center gap-2.5">
      <Icon className="size-4 shrink-0 text-muted-foreground" strokeWidth={1.8} aria-hidden />
      <span className="sr-only">{label}: </span>
      <span className="min-w-0 flex-1 truncate text-[13.5px]">{children}</span>
      <CopyButton value={copyValue} label={label.toLowerCase()} />
    </li>
  );
}

const compactPhone = (v?: string | null) => (v ?? "").replace(/[^\d+]/g, "");
const linkClass = "rounded underline-offset-2 hover:text-primary-hover hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40";

function Contact({ p }: { p: ConversationProfile }) {
  const lead = p.lead;
  const phone = p.phone || lead?.phone || lead?.mobile || "";
  const mobile = lead?.mobile && compactPhone(lead.mobile) !== compactPhone(phone) ? lead.mobile : "";
  const email = lead?.email?.trim() ?? "";
  const website = lead?.website?.trim() ?? "";
  const websiteHref = website && !/^https?:\/\//i.test(website) ? `https://${website}` : website;

  return (
    <section>
      <SectionLabel>Contact</SectionLabel>
      {phone || mobile || email || website ? (
        <ul className="space-y-1.5">
          {phone ? (
            <ContactRow icon={Phone} label="Phone" copyValue={phone}>
              <span className="tabular-nums" title={phone}>
                {formatPhone(phone)}
              </span>
            </ContactRow>
          ) : null}
          {mobile ? (
            <ContactRow icon={Smartphone} label="Mobile" copyValue={mobile}>
              <span className="tabular-nums" title={mobile}>
                {formatPhone(mobile)}
              </span>
            </ContactRow>
          ) : null}
          {email ? (
            <ContactRow icon={Mail} label="Email" copyValue={email}>
              <a href={`mailto:${email}`} className={linkClass} title={email}>
                {email}
              </a>
            </ContactRow>
          ) : null}
          {website ? (
            <ContactRow icon={Globe} label="Website" copyValue={websiteHref}>
              <a href={websiteHref} target="_blank" rel="noreferrer noopener" className={linkClass} title={websiteHref}>
                {website.replace(/^https?:\/\//i, "").replace(/\/$/, "")}
              </a>
            </ContactRow>
          ) : null}
        </ul>
      ) : (
        <p className="text-[13px] leading-relaxed text-muted-foreground">{p.kind === "web" ? "No phone number — this call came from the browser." : "No contact details yet."}</p>
      )}
    </section>
  );
}

// ---------------------------------------------------------------- 4. relationship

function StatCell({ label, value, title }: { label: string; value: React.ReactNode; title?: string }) {
  return (
    <div className="min-w-0">
      <dt className="text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground">{label}</dt>
      <dd className="mt-0.5 truncate text-[15px] font-medium tabular-nums" title={title}>
        {value}
      </dd>
    </div>
  );
}

/** m:ss like everywhere else; switches to "1h 05m" once the relationship passes an hour of talk time. */
function formatTalkTime(secs: number): string {
  if (!secs || secs < 3600) return formatDuration(secs);
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  return `${h}h ${m.toString().padStart(2, "0")}m`;
}

function Relationship({ stats }: { stats: ConversationProfile["stats"] }) {
  const outcomes = [stats.successCount ? `${formatNumber(stats.successCount)} successful` : "", stats.failedCount ? `${formatNumber(stats.failedCount)} failed` : ""].filter(Boolean).join(" · ");
  return (
    <section>
      <SectionLabel>Relationship</SectionLabel>
      <dl className="grid grid-cols-2 gap-x-6 gap-y-3.5">
        <StatCell label="Calls" value={formatNumber(stats.totalCalls)} />
        <StatCell label="Connected" value={formatNumber(stats.connectedCalls)} />
        <StatCell label="Talk time" value={formatTalkTime(stats.totalTalkSecs)} />
        <StatCell label="Last contact" value={stats.lastCallAt ? relativeTime(stats.lastCallAt) : "—"} title={stats.lastCallAt ? formatDateTime(stats.lastCallAt) : undefined} />
      </dl>
      <p className="mt-3 text-[12px] leading-relaxed text-muted-foreground">
        {stats.firstCallAt ? `First contact ${formatDateTime(stats.firstCallAt)}` : "No earlier contact on record"}
        {outcomes ? ` · ${outcomes}` : ""}
      </p>
    </section>
  );
}

// ---------------------------------------------------------------- 5. learned in calls

function CapturedRow({ item, onSelectConversation }: { item: ConversationProfileCaptured; onSelectConversation: (id: string) => void }) {
  const ai = item.source === "ai";
  const SourceIcon = ai ? Sparkles : Bot;
  const sourceLabel = ai ? "Extracted by AI from the transcript" : "Collected by the agent";
  return (
    <li className="flex min-w-0 gap-2.5">
      <Tip label={sourceLabel}>
        <span tabIndex={0} role="img" aria-label={sourceLabel} className={cn("mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40", ai ? "bg-accent-tint text-primary-hover" : "bg-muted text-muted-foreground")}>
          <SourceIcon className="size-3" strokeWidth={1.8} />
        </span>
      </Tip>
      <div className="min-w-0 flex-1">
        <div className="flex min-w-0 items-center gap-1.5">
          <span className="min-w-0 truncate text-[12px] text-muted-foreground" title={item.label}>
            {item.label}
          </span>
          {item.thisCall ? (
            <Badge variant="soft" className="shrink-0 px-1.5 py-0 text-[10px]">
              This call
            </Badge>
          ) : null}
        </div>
        <p className="whitespace-pre-wrap break-words text-[13.5px] leading-snug [overflow-wrap:anywhere]">{item.value}</p>
        {!item.thisCall ? (
          <button
            type="button"
            onClick={() => onSelectConversation(item.conversationId)}
            className="mt-0.5 rounded text-[11.5px] text-muted-foreground underline-offset-2 hover:text-foreground hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
          >
            From an earlier call{item.at ? ` · ${relativeTime(item.at)}` : ""}
          </button>
        ) : null}
      </div>
    </li>
  );
}

function Learned({ items, onSelectConversation }: { items: ConversationProfileCaptured[]; onSelectConversation: (id: string) => void }) {
  const listId = useId();
  const [expanded, setExpanded] = useState(false);
  const visible = expanded ? items : items.slice(0, CAPTURED_VISIBLE);
  return (
    <section>
      <SectionLabel>Learned in calls</SectionLabel>
      {items.length ? (
        <>
          <ul id={listId} className="space-y-3">
            {visible.map((item) => (
              <CapturedRow key={item.key} item={item} onSelectConversation={onSelectConversation} />
            ))}
          </ul>
          {items.length > CAPTURED_VISIBLE ? <ShowAllToggle expanded={expanded} total={items.length} onToggle={() => setExpanded((e) => !e)} controls={listId} /> : null}
        </>
      ) : (
        <p className="text-[13px] leading-relaxed text-muted-foreground">Nothing captured yet. Details the agent collects, or AI picks up from the transcript, will build up here call after call.</p>
      )}
    </section>
  );
}

// ---------------------------------------------------------------- 6. written back to the CRM

function CrmUpdates({ fields }: { fields: ConversationProfile["updatedCrmFields"] }) {
  if (!fields.length) return null;
  return (
    <section>
      <SectionLabel>Updated in CRM by this call</SectionLabel>
      <ul className="flex flex-wrap gap-1.5">
        {fields.map((f) => (
          <li key={f.apiName} className="max-w-full">
            <Badge variant="soft" className="max-w-full" title={f.apiName}>
              <Check /> <span className="truncate">{f.label || titleCase(f.apiName)}</span>
            </Badge>
          </li>
        ))}
      </ul>
    </section>
  );
}

// ---------------------------------------------------------------- 7. CRM fields

function crmRows(lead: ConversationProfileLead): { key: string; label: string; value: string }[] {
  const rows = [
    { key: "std:industry", label: "Industry", value: lead.industry ?? "" },
    { key: "std:leadSource", label: "Lead source", value: lead.leadSource ?? "" },
    { key: "std:description", label: "Description", value: lead.description ?? "" },
    ...(lead.fields ?? []).map((f) => ({ key: f.apiName, label: f.label || titleCase(f.apiName), value: String(f.value ?? "") })),
  ];
  const seen = new Set<string>();
  return rows.filter((r) => {
    const id = r.label.trim().toLowerCase();
    if (!r.value.trim() || seen.has(id)) return false;
    seen.add(id);
    return true;
  });
}

function CrmFields({ lead }: { lead: ConversationProfileLead }) {
  const listId = useId();
  const [expanded, setExpanded] = useState(false);
  const rows = crmRows(lead);
  const visible = expanded ? rows : rows.slice(0, CRM_FIELDS_VISIBLE);
  const n = lead.emptyFieldCount ?? 0;
  const lists = lead.listNames ?? [];
  const tags = lead.tags ?? [];
  return (
    <section>
      <SectionLabel>CRM fields</SectionLabel>
      {rows.length ? (
        <dl id={listId} className="space-y-2">
          {visible.map((r) => (
            <div key={r.key} className="grid grid-cols-[minmax(0,5fr)_minmax(0,7fr)] gap-3 text-[13px] leading-snug">
              <dt className="truncate text-muted-foreground" title={r.label}>
                {r.label}
              </dt>
              <dd className={cn("min-w-0 break-words [overflow-wrap:anywhere]", !expanded && "line-clamp-3")}>{r.value}</dd>
            </div>
          ))}
        </dl>
      ) : (
        <p className="text-[13px] text-muted-foreground">No other CRM fields are filled in yet.</p>
      )}
      {rows.length > CRM_FIELDS_VISIBLE ? <ShowAllToggle expanded={expanded} total={rows.length} onToggle={() => setExpanded((e) => !e)} controls={listId} /> : null}
      {n > 0 ? (
        <p className="mt-3 text-[12px] leading-relaxed text-muted-foreground">
          {formatNumber(n)} field{n === 1 ? "" : "s"} still empty — the agent fills these on the next call
        </p>
      ) : null}
      {lists.length || tags.length ? (
        <ul className="mt-3 flex flex-wrap gap-1.5" aria-label="Lists and tags">
          {lists.map((name, i) => (
            <li key={`list:${i}:${name}`} className="max-w-full">
              <Badge variant="outline" className="max-w-full text-muted-foreground">
                <Table2 /> <span className="truncate">{name}</span>
              </Badge>
            </li>
          ))}
          {tags.map((tag, i) => (
            <li key={`tag:${i}:${tag}`} className="max-w-full">
              <Badge variant="secondary" className="max-w-full">
                <span className="truncate">{tag}</span>
              </Badge>
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}

// ---------------------------------------------------------------- 8. call history

function historyBadge(h: ConversationProfileHistoryItem) {
  return h.status === "done" ? outcomeMeta(h.callSuccessful as Conversation["callSuccessful"]) : statusMeta(h.status as Conversation["status"]);
}

function HistoryRowBody({ h }: { h: ConversationProfileHistoryItem }) {
  const badge = historyBadge(h);
  const meta = [h.agentName, h.direction ? titleCase(h.direction) : ""].filter(Boolean).join(" · ");
  return (
    <>
      <span className="flex items-center justify-between gap-2">
        <span className="min-w-0 truncate text-[12.5px] font-medium">
          {h.startedAt ? formatDateTime(h.startedAt) : "Date unknown"}
          <span className="font-normal tabular-nums text-muted-foreground"> · {formatDuration(h.durationSecs)}</span>
        </span>
        <Badge variant={badge.variant} className="shrink-0">
          {badge.label}
        </Badge>
      </span>
      <span className="mt-0.5 flex min-w-0 items-center gap-1.5">
        {h.sentiment ? <SentimentDot sentiment={h.sentiment} className="size-1.5" /> : null}
        <span className={cn("min-w-0 truncate text-[13px]", h.title ? "text-foreground/90" : "italic text-muted-foreground/80")} title={h.title}>
          {h.title || (h.status === "failed" || !h.durationSecs ? "Did not connect" : "No summary yet")}
        </span>
      </span>
      {meta || h.current ? (
        <span className="mt-0.5 block truncate text-[11.5px] text-muted-foreground">
          {h.current ? <span className="font-medium text-primary-hover">This call</span> : null}
          {h.current && meta ? " · " : ""}
          {meta}
        </span>
      ) : null}
    </>
  );
}

function History({ p, onSelectConversation }: { p: ConversationProfile; onSelectConversation: (id: string) => void }) {
  const items = p.history ?? [];
  const hidden = Math.max(0, p.stats.totalCalls - items.length);
  return (
    <section>
      <SectionLabel>Call history</SectionLabel>
      {items.length ? (
        <ol>
          {items.map((h, i) => (
            <li key={h._id} className="relative flex gap-2.5 pb-1.5 last:pb-0">
              <span className="relative flex w-3 shrink-0 justify-center" aria-hidden>
                {i < items.length - 1 ? <span className="absolute -bottom-[15px] top-[23px] w-px bg-border" /> : null}
                <span className={cn("relative mt-[11px] size-2.5 rounded-full border-2", h.current ? "border-primary bg-primary" : "border-muted-foreground/40 bg-card")} />
              </span>
              {h.current ? (
                <div aria-current="true" className="min-w-0 flex-1 rounded-lg bg-accent-tint/50 px-2.5 py-1.5">
                  <HistoryRowBody h={h} />
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => onSelectConversation(h._id)}
                  className="block min-w-0 flex-1 rounded-lg px-2.5 py-1.5 text-left transition-colors hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
                >
                  <span className="sr-only">Open call: </span>
                  <HistoryRowBody h={h} />
                </button>
              )}
            </li>
          ))}
        </ol>
      ) : (
        <p className="text-[13px] text-muted-foreground">No calls on record yet.</p>
      )}
      {items.length === 1 && items[0].current && p.stats.totalCalls <= 1 ? <p className="mt-2 text-[12px] text-muted-foreground">This is the first conversation with this {p.kind === "lead" ? "lead" : "caller"}.</p> : null}
      {hidden > 0 ? (
        <p className="mt-2 text-[12px] text-muted-foreground">
          Showing the latest {items.length} of {formatNumber(p.stats.totalCalls)} calls.
        </p>
      ) : null}
    </section>
  );
}

// ---------------------------------------------------------------- states

export function ProfileSkeleton({ className }: { className?: string }) {
  return (
    <div className={cn("space-y-7", className)} aria-busy aria-label="Loading profile">
      <div className="flex items-start gap-3.5">
        <Skeleton className="size-14 shrink-0 rounded-full" />
        <div className="min-w-0 flex-1 space-y-2 pt-1">
          <Skeleton className="h-5 w-40 max-w-full" />
          <Skeleton className="h-3.5 w-32 max-w-full" />
          <div className="flex gap-1.5 pt-0.5">
            <Skeleton className="h-5 w-20 rounded-full" />
            <Skeleton className="h-5 w-16 rounded-full" />
          </div>
        </div>
      </div>
      <div className="flex gap-2">
        <Skeleton className="h-8 w-28" />
        <Skeleton className="h-8 w-24" />
      </div>
      <div className="space-y-2.5">
        <Skeleton className="h-3 w-16" />
        <Skeleton className="h-4 w-44 max-w-full" />
        <Skeleton className="h-4 w-52 max-w-full" />
      </div>
      <div className="space-y-2.5">
        <Skeleton className="h-3 w-24" />
        <div className="grid grid-cols-2 gap-x-6 gap-y-3.5">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="space-y-1.5">
              <Skeleton className="h-3 w-16" />
              <Skeleton className="h-5 w-12" />
            </div>
          ))}
        </div>
      </div>
      <div className="space-y-3">
        <Skeleton className="h-3 w-28" />
        {[0, 1, 2].map((i) => (
          <div key={i} className="flex gap-2.5">
            <Skeleton className="size-5 shrink-0 rounded-full" />
            <div className="flex-1 space-y-1.5">
              <Skeleton className="h-3 w-24" />
              <Skeleton className="h-4 w-4/5" />
            </div>
          </div>
        ))}
      </div>
      <div className="space-y-3">
        <Skeleton className="h-3 w-24" />
        {[0, 1, 2].map((i) => (
          <div key={i} className="flex gap-2.5">
            <Skeleton className="mt-1 size-2.5 shrink-0 rounded-full" />
            <div className="flex-1 space-y-1.5">
              <Skeleton className="h-3.5 w-full" />
              <Skeleton className="h-3.5 w-2/3" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function ProfileError({ message, onRetry, retrying }: { message: string; onRetry: () => void; retrying: boolean }) {
  return (
    <div role="alert" className="flex items-start gap-2.5 rounded-lg border border-dashed border-border px-3 py-3">
      <CircleAlert className="mt-0.5 size-4 shrink-0 text-destructive" strokeWidth={1.8} />
      <div className="min-w-0 flex-1">
        <p className="text-[13px] font-medium">Couldn&apos;t load the profile</p>
        <p className="mt-0.5 break-words text-[12.5px] leading-relaxed text-muted-foreground">{message}</p>
        <Button variant="outline" size="xs" className="mt-2" onClick={onRetry} loading={retrying}>
          Retry
        </Button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- panel

/**
 * Who is on this call and the relationship so far. Works for a linked lead, an unknown phone caller and a browser call.
 * `rail` = the fixed right column of the conversation view (scrolls on its own); `tab` = inline inside the "Profile" tab.
 */
export function LeadProfilePanel({ conversationId, onSelectConversation, variant = "rail" }: { conversationId: string; onSelectConversation: (id: string) => void; variant?: "rail" | "tab" }) {
  const { data: p, isLoading, isError, error, refetch, isFetching } = useConversationProfile(conversationId);
  const [saveOpen, setSaveOpen] = useState(false);
  // Once the caller is a lead there is nothing left to save — also covers the save succeeding while the dialog is open.
  if (saveOpen && p?.lead) setSaveOpen(false);

  return (
    <div className={cn("min-w-0", variant === "rail" ? "min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 py-5" : "max-w-[560px] pb-2")}>
      {isLoading ? (
        <ProfileSkeleton />
      ) : isError || !p ? (
        <ProfileError message={isError ? errorMessage(error) : "No profile is available for this conversation."} onRetry={() => refetch()} retrying={isFetching} />
      ) : (
        <div className="space-y-7">
          <div className="space-y-4">
            <Identity p={p} />
            <Actions p={p} onSave={() => setSaveOpen(true)} />
          </div>
          <Contact p={p} />
          <Relationship stats={p.stats} />
          <Learned items={p.captured ?? []} onSelectConversation={onSelectConversation} />
          <CrmUpdates fields={p.updatedCrmFields ?? []} />
          {p.lead ? <CrmFields lead={p.lead} /> : null}
          <History p={p} onSelectConversation={onSelectConversation} />
          <SaveAsLeadDialog open={saveOpen && !p.lead} onOpenChange={setSaveOpen} conversationId={conversationId} phone={p.phone} suggested={p.suggestedLead ?? {}} />
        </div>
      )}
    </div>
  );
}

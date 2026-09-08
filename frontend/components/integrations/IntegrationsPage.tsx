"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, AudioWaveform, Plug, RefreshCw, ArrowRight } from "lucide-react";
import { toast } from "sonner";
import type { IntegrationItem } from "@/lib/types";
import { useIntegrations } from "@/hooks/api";
import { errorMessage } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { Segmented } from "@/components/ui/segmented";
import { Skeleton } from "@/components/ui/skeleton";
import { ComingSoonCard } from "./IntegrationCard";
import { ElevenLabsCard } from "./ElevenLabsCard";
import { ZohoCard } from "./ZohoCard";
import { CATEGORY_LABELS, CATEGORY_ORDER, type Category } from "./integrationCopy";

type Filter = "all" | Category;

export function IntegrationsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const qc = useQueryClient();
  const integrations = useIntegrations();
  const [filter, setFilter] = useState<Filter>("all");

  // OAuth return: /integrations?provider=zoho&status=connected|error&message=
  const handled = useRef(false);
  useEffect(() => {
    if (handled.current) return;
    const provider = searchParams.get("provider");
    if (provider !== "zoho") return;
    handled.current = true;
    const status = searchParams.get("status");
    const message = searchParams.get("message");
    if (status === "connected") toast.success("Zoho CRM connected — click Sync now to import leads");
    else toast.error(message || "Zoho connection failed");
    qc.invalidateQueries({ queryKey: ["zoho"] });
    qc.invalidateQueries({ queryKey: ["integrations"] });
    router.replace("/integrations");
  }, [searchParams, router, qc]);

  const groups = useMemo(() => {
    const d = integrations.data;
    if (!d) return [];
    return CATEGORY_ORDER.map((cat) => ({ cat, items: (d[cat] ?? []) as IntegrationItem[] })).filter((g) => g.items.length && (filter === "all" || filter === g.cat));
  }, [integrations.data, filter]);

  const counts = useMemo(() => {
    const d = integrations.data;
    const c: Record<string, number> = {};
    if (!d) return c;
    for (const cat of CATEGORY_ORDER) c[cat] = (d[cat] ?? []).length;
    c.all = Object.values(c).reduce((a, b) => a + b, 0);
    return c;
  }, [integrations.data]);

  return (
    <div className="flex flex-1 flex-col">
      <PageHeader title="Integrations" description="Connect your CRM, voice provider and channels.">
        <Segmented<Filter>
          value={filter}
          onChange={setFilter}
          options={[
            { value: "all", label: "All", count: counts.all },
            ...CATEGORY_ORDER.map((c) => ({ value: c, label: CATEGORY_LABELS[c], count: counts[c] })),
          ]}
        />
      </PageHeader>

      <div className="flex flex-col gap-8 px-7 pb-10">
        {integrations.isLoading ? (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-44 w-full rounded-xl" />
            ))}
          </div>
        ) : integrations.error ? (
          <div className="rounded-xl border border-border bg-card">
            <EmptyState icon={AlertTriangle} title="Could not load integrations" description={errorMessage(integrations.error)} action={<Button variant="outline" onClick={() => integrations.refetch()}>Retry</Button>} />
          </div>
        ) : (
          groups.map(({ cat, items }) => (
            <section key={cat}>
              {filter === "all" ? (
                <div className="mb-3 flex items-baseline gap-2">
                  <h2 className="font-heading text-[18px]">{CATEGORY_LABELS[cat]}</h2>
                  <span className="text-xs text-muted-foreground">
                    {items.filter((i) => i.available).length} available · {items.filter((i) => !i.available).length} coming soon
                  </span>
                </div>
              ) : null}
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {items.map((item) => {
                  if (!item.available) return <ComingSoonCard key={item.id} item={item} />;
                  if (item.id === "zoho") return <ZohoCard key={item.id} item={item} />;
                  if (item.id === "elevenlabs") return <ElevenLabsCard key={item.id} item={item} />;
                  return <ComingSoonCard key={item.id} item={item} />;
                })}
              </div>
            </section>
          ))
        )}

        <HowSyncingWorks />
      </div>
    </div>
  );
}

function HowSyncingWorks() {
  const steps = [
    { icon: Plug, title: "Connect Zoho CRM", body: "Authorize Matrix once with your Zoho account. We only request access to the Leads module." },
    { icon: RefreshCw, title: "Sync now", body: "Pulls every lead (and all its fields) into My Leads. Later syncs only fetch what changed." },
    { icon: AudioWaveform, title: "Attach a voice agent", body: "The agent calls your leads. After each call, empty fields are filled from the collected answers and written back to Zoho." },
  ];
  return (
    <div className="rounded-xl border border-border bg-card p-5 shadow-xs">
      <h3 className="font-heading text-[17px]">How syncing works</h3>
      <div className="mt-4 grid gap-4 md:grid-cols-3">
        {steps.map((s, i) => {
          const Icon = s.icon;
          return (
            <div key={s.title} className="relative flex gap-3">
              <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-accent-tint text-primary-hover">
                <Icon className="size-4" strokeWidth={1.8} />
              </span>
              <div className="min-w-0">
                <div className="flex items-center gap-1.5 text-sm font-medium">
                  <span className="text-muted-foreground">{i + 1}.</span> {s.title}
                </div>
                <p className="mt-0.5 text-[13px] leading-snug text-muted-foreground">{s.body}</p>
              </div>
              {i < steps.length - 1 ? <ArrowRight className="absolute -right-3 top-2.5 hidden size-4 text-muted-foreground/60 md:block" /> : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}

"use client";
import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { AudioWaveform, Braces, Cpu, Headphones, Info, Languages, MessageSquare, MicVocal, Pencil, PhoneOutgoing, Plus, TriangleAlert } from "lucide-react";
import { useAgents, useCatalog, useVoices } from "@/hooks/api";
import { errorMessage } from "@/lib/api";
import { optionLabel, voiceName } from "@/components/agents/agent-utils";
import { KeyValueEditor } from "@/components/agents/form/primitives";
import { ElevenLabsRequired, isElevenNotConfigured } from "@/components/integrations/ElevenLabsRequired";
import { CallPanel } from "@/components/test/CallPanel";
import { PhoneCallPanel } from "@/components/test/PhoneCallPanel";
import { useTestCall } from "@/components/test/useTestCall";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Label } from "@/components/ui/label";
import { PageHeader } from "@/components/ui/page-header";
import { Segmented } from "@/components/ui/segmented";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";

type Mode = "browser" | "phone";
const DESCRIPTION = "Telephonic test: ring a real phone number with your agent and watch the call come back with its transcript. For a quick in-browser web call, use Preview on the agent card.";

function TestSkeleton() {
  return (
    <div className="flex flex-1 flex-col">
      <div className="px-7 pb-4 pt-7">
        <Skeleton className="h-8 w-40" />
        <Skeleton className="mt-2 h-4 w-96" />
      </div>
      <div className="grid gap-5 px-7 pb-8 lg:grid-cols-[360px_minmax(0,1fr)]">
        <div className="space-y-4">
          <Skeleton className="h-24 rounded-xl" />
          <Skeleton className="h-56 rounded-xl" />
          <Skeleton className="h-40 rounded-xl" />
        </div>
        <Skeleton className="h-[520px] rounded-xl" />
      </div>
    </div>
  );
}

export default function TestPage() {
  return (
    <Suspense fallback={<TestSkeleton />}>
      <TestPageInner />
    </Suspense>
  );
}

function SummaryRow({ icon: Icon, label, value }: { icon: typeof Cpu; label: string; value: string }) {
  return (
    <div className="flex items-start gap-2.5 py-2">
      <Icon className="mt-0.5 size-4 shrink-0 text-muted-foreground" strokeWidth={1.7} />
      <div className="min-w-0 flex-1">
        <div className="text-[11px] uppercase tracking-[0.06em] text-muted-foreground">{label}</div>
        <div className="truncate text-sm">{value}</div>
      </div>
    </div>
  );
}

function fillVars(text: string, vars: Record<string, string>): string {
  return text.replace(/\{\{\s*([\w.-]+)\s*\}\}/g, (m, k: string) => (vars[k] !== undefined && vars[k] !== "" ? vars[k] : m));
}

function TestPageInner() {
  const params = useSearchParams();
  const router = useRouter();
  const agents = useAgents();
  const catalog = useCatalog();
  const voices = useVoices();
  const call = useTestCall();
  const inCall = call.status === "connecting" || call.status === "connected" || call.status === "disconnecting";

  const paramAgent = params.get("agent") ?? "";
  const [agentId, setAgentId] = useState(paramAgent);
  const [mode, setMode] = useState<Mode>(params.get("mode") === "browser" ? "browser" : "phone");
  useEffect(() => {
    if (!agents.data?.length) return;
    const exists = agents.data.some((a) => a._id === agentId);
    if (!exists) setAgentId(agents.data.some((a) => a._id === paramAgent) ? paramAgent : agents.data[0]._id);
  }, [agents.data, agentId, paramAgent]);

  const agent = useMemo(() => agents.data?.find((a) => a._id === agentId), [agents.data, agentId]);

  const [vars, setVars] = useState<Record<string, string>>({});
  const varsFor = useRef<string | null>(null);
  useEffect(() => {
    if (!agent || varsFor.current === agent._id) return;
    varsFor.current = agent._id;
    setVars({ ...(agent.config?.dynamic_variable_placeholders ?? {}) });
  }, [agent]);

  const syncUrl = (id: string, m: Mode) => router.replace(`/test?agent=${encodeURIComponent(id)}${m === "browser" ? "&mode=browser" : ""}`);
  const selectAgent = (id: string) => {
    setAgentId(id);
    syncUrl(id, mode);
  };
  const selectMode = (m: Mode) => {
    setMode(m);
    if (agentId) syncUrl(agentId, m);
  };

  const cfg = agent?.config;
  const firstMessagePreview = cfg?.first_message ? fillVars(cfg.first_message, vars) : "";

  return (
    <div className="flex flex-1 flex-col">
      <PageHeader title="AI Test" description={DESCRIPTION} />

      <div className="px-7 pb-8">
        {agents.isPending ? (
          <div className="grid gap-5 lg:grid-cols-[360px_minmax(0,1fr)]">
            <div className="space-y-4">
              <Skeleton className="h-24 rounded-xl" />
              <Skeleton className="h-56 rounded-xl" />
            </div>
            <Skeleton className="h-[520px] rounded-xl" />
          </div>
        ) : agents.isError ? (
          isElevenNotConfigured(agents.error) ? (
            <ElevenLabsRequired description="Test calls ring through your own ElevenLabs account. Connect it in Integrations, create an agent, then come back here to talk to it." />
          ) : (
            <EmptyState
              icon={TriangleAlert}
              title="Couldn't load agents"
              description={errorMessage(agents.error)}
              action={
                <Button variant="outline" onClick={() => agents.refetch()}>
                  Retry
                </Button>
              }
            />
          )
        ) : !agents.data?.length ? (
          <EmptyState
            icon={AudioWaveform}
            title="No agents to test yet"
            description="Create a voice agent first, then come back here to talk to it."
            action={
              <Link href="/agents/new" className={buttonVariants()}>
                <Plus /> New agent
              </Link>
            }
          />
        ) : (
          <div className="grid gap-5 lg:grid-cols-[360px_minmax(0,1fr)]">
            {/* left column */}
            <div className="flex flex-col gap-4">
              <div className="rounded-xl border border-border bg-card p-4 shadow-xs">
                <Label htmlFor="test-agent">Agent</Label>
                <Select value={agentId} onValueChange={selectAgent} disabled={inCall}>
                  <SelectTrigger id="test-agent" className="mt-1.5">
                    <SelectValue placeholder="Choose an agent" />
                  </SelectTrigger>
                  <SelectContent>
                    {agents.data.map((a) => (
                      <SelectItem key={a._id} value={a._id} description={`${optionLabel(catalog.data?.languages, a.config?.language, a.config?.language)} · ${voiceName(voices.data, a.config?.voice_id)}`}>
                        {a.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {inCall ? <p className="mt-1.5 text-xs text-muted-foreground">End the call to switch agents.</p> : null}
              </div>

              {agent && cfg ? (
                <div className="rounded-xl border border-border bg-card shadow-xs">
                  <div className="flex items-center justify-between border-b border-border px-4 py-3">
                    <span className="text-sm font-medium">Agent summary</span>
                    <Link href={`/agents/${agent._id}`} className={buttonVariants({ variant: "ghost", size: "xs" })}>
                      <Pencil /> Edit
                    </Link>
                  </div>
                  <div className="divide-y divide-border px-4">
                    <SummaryRow icon={MicVocal} label="Voice" value={voiceName(voices.data, cfg.voice_id)} />
                    <SummaryRow icon={Languages} label="Language" value={`${optionLabel(catalog.data?.languages, cfg.language, cfg.language)}${cfg.additional_languages?.length ? ` +${cfg.additional_languages.length}` : ""}`} />
                    <SummaryRow icon={Cpu} label="LLM" value={optionLabel(catalog.data?.llmModels, cfg.llm, cfg.llm)} />
                    <SummaryRow icon={AudioWaveform} label="TTS model" value={optionLabel(catalog.data?.ttsModels, cfg.tts_model_id, cfg.tts_model_id)} />
                    <div className="flex items-start gap-2.5 py-2">
                      <MessageSquare className="mt-0.5 size-4 shrink-0 text-muted-foreground" strokeWidth={1.7} />
                      <div className="min-w-0 flex-1">
                        <div className="text-[11px] uppercase tracking-[0.06em] text-muted-foreground">First message</div>
                        <div className="text-sm leading-relaxed">{firstMessagePreview ? <span className="italic">“{firstMessagePreview}”</span> : <span className="text-muted-foreground">Caller speaks first</span>}</div>
                      </div>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-1.5 border-t border-border px-4 py-3">
                    {(cfg.built_in_tools ?? []).map((t) => (
                      <Badge key={t} variant="outline">
                        {optionLabel(catalog.data?.builtInTools, t, t)}
                      </Badge>
                    ))}
                    {cfg.data_collection?.length ? <Badge variant="soft">{cfg.data_collection.length} fields collected</Badge> : null}
                  </div>
                </div>
              ) : null}

              <div className="rounded-xl border border-border bg-card p-4 shadow-xs">
                <div className="mb-1 flex items-center gap-1.5 text-sm font-medium">
                  <Braces className="size-4 text-primary" /> Dynamic variables
                </div>
                <p className="mb-3 text-xs text-muted-foreground">Pre-filled from the agent's placeholders. On real calls Matrix fills these from the lead record.</p>
                <KeyValueEditor value={vars} onChange={setVars} keyPlaceholder="name" valuePlaceholder="Priya" addLabel="Add variable" disabled={inCall} emptyText="No variables — the agent's placeholder defaults will be used." />
              </div>

              {mode === "browser" ? (
                <div className="flex items-start gap-2.5 rounded-xl border border-border bg-muted/40 p-4 text-xs text-muted-foreground">
                  <Headphones className="mt-0.5 size-4 shrink-0 text-primary" />
                  <div>
                    <div className="font-medium text-foreground">Microphone & audio</div>
                    <p className="mt-0.5 leading-5">Your browser will ask for microphone access when you start. Use headphones to avoid the agent hearing itself. Test calls count towards your ElevenLabs usage like any other conversation.</p>
                  </div>
                </div>
              ) : (
                <div className="flex items-start gap-2.5 rounded-xl border border-border bg-muted/40 p-4 text-xs text-muted-foreground">
                  <PhoneOutgoing className="mt-0.5 size-4 shrink-0 text-primary" />
                  <div>
                    <div className="font-medium text-foreground">Real phone call</div>
                    <p className="mt-0.5 leading-5">The agent dials you from the selected number. Answer like a lead would — the transcript, summary and collected data land here and in Conversations when the call ends.</p>
                  </div>
                </div>
              )}

              {cfg && !cfg.post_call_webhook_enabled ? (
                <div className="flex items-start gap-2.5 rounded-xl border border-amber-200 bg-amber-50 p-4 text-xs text-amber-800 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-200">
                  <Info className="mt-0.5 size-4 shrink-0" />
                  <p className="leading-5">This agent's post-call webhook is off — use {mode === "browser" ? "“Sync conversation now”" : "“Refresh from ElevenLabs”"} after the call to pull the transcript into Matrix.</p>
                </div>
              ) : null}
            </div>

            {/* right column */}
            <div className="flex min-w-0 flex-col gap-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <Segmented<Mode>
                  value={mode}
                  onChange={selectMode}
                  options={[
                    { value: "phone", label: "Phone call", icon: PhoneOutgoing, disabled: inCall },
                    { value: "browser", label: "Browser call", icon: Headphones },
                  ]}
                />
                <span className="text-xs text-muted-foreground">{mode === "browser" ? "Uses your microphone — no phone number needed." : "Rings a real phone from one of your numbers."}</span>
              </div>
              {/* Both panels stay mounted so a browser call or a placed phone call survives switching modes. */}
              <div className={mode === "browser" ? undefined : "hidden"}>
                <CallPanel call={call} agent={agent} dynamicVariables={vars} />
              </div>
              <PhoneCallPanel agent={agent} dynamicVariables={vars} className={mode === "phone" ? undefined : "hidden"} />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

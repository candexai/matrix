"use client";
import { useMemo, useRef, useState, type DragEvent } from "react";
import { FileText, Globe, Loader2, Type, Upload, X } from "lucide-react";
import { useAddKnowledgeDoc } from "@/hooks/api";
import { errorMessage } from "@/lib/api";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Dialog, DialogBody, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { formatBytes } from "./resource-panel";

type Kind = "url" | "text" | "file";

const ACCEPT = ".pdf,.docx,.txt,.html,.epub";
const ACCEPT_EXT = new Set(ACCEPT.split(","));
const MAX_BYTES = 25 * 1024 * 1024;
const MAX_TEXT = 500_000;

function validateDoc(kind: Kind, url: string, text: string, name: string, file: File | null): Record<string, string> {
  const e: Record<string, string> = {};
  if (kind === "url") {
    const u = url.trim();
    if (!u) e.url = "Enter the page URL.";
    else {
      try {
        const p = new URL(u).protocol;
        if (p !== "http:" && p !== "https:") e.url = "Use a full http(s) URL.";
      } catch {
        e.url = "Enter a full URL starting with https://";
      }
    }
  }
  if (kind === "text") {
    if (!name.trim()) e.name = "Give it a name so you can find it later.";
    if (!text.trim()) e.text = "Paste the content to index.";
    else if (text.length > MAX_TEXT) e.text = "500,000 characters max — split it into several documents.";
  }
  if (kind === "file" && !file) e.file = "Choose a file to upload.";
  if (name.length > 120) e.name = "120 characters max.";
  return e;
}

/** Backend message for the multipart upload (that request bypasses the normalising api client). */
function uploadErrorMessage(e: unknown): string {
  const r = e as { response?: { status?: number; data?: { error?: { message?: string } } } };
  if (r?.response?.status === 413) return "File is too large — the limit is 25 MB.";
  return r?.response?.data?.error?.message || errorMessage(e);
}

export function KnowledgeDocDialog({ open, onOpenChange, onAdded }: { open: boolean; onOpenChange: (open: boolean) => void; onAdded: (doc: { id: string; name: string }) => void }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="lg">
        <DocForm onAdded={onAdded} onClose={() => onOpenChange(false)} />
      </DialogContent>
    </Dialog>
  );
}

function DocForm({ onAdded, onClose }: { onAdded: (doc: { id: string; name: string }) => void; onClose: () => void }) {
  const add = useAddKnowledgeDoc();
  const [kind, setKind] = useState<Kind>("url");
  const [url, setUrl] = useState("");
  const [text, setText] = useState("");
  const [name, setName] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const errors = useMemo(() => (submitted ? validateDoc(kind, url, text, name, file) : {}), [submitted, kind, url, text, name, file]);

  const pick = (f: File | undefined | null) => {
    setFileError(null);
    if (!f) return;
    const ext = /\.[a-z0-9]+$/i.exec(f.name)?.[0]?.toLowerCase() ?? "";
    if (!ACCEPT_EXT.has(ext)) {
      setFileError("Use a PDF, DOCX, TXT, HTML or EPUB file.");
      return;
    }
    if (f.size > MAX_BYTES) {
      setFileError(`${formatBytes(f.size)} is over the 25 MB limit.`);
      return;
    }
    setFile(f);
  };
  const onDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragging(false);
    pick(e.dataTransfer.files?.[0]);
  };

  const switchKind = (k: Kind) => {
    setKind(k);
    setSubmitted(false);
    setSubmitError(null);
  };

  const submit = async () => {
    setSubmitted(true);
    setSubmitError(null);
    if (Object.keys(validateDoc(kind, url, text, name, file)).length) return;
    const optName = name.trim() || undefined;
    try {
      const doc =
        kind === "url" ? await add.mutateAsync({ kind: "url", url: url.trim(), name: optName }) : kind === "text" ? await add.mutateAsync({ kind: "text", text, name: optName }) : await add.mutateAsync({ kind: "file", file: file as File, name: optName });
      onAdded(doc);
      onClose();
    } catch (e) {
      setSubmitError(kind === "file" ? uploadErrorMessage(e) : errorMessage(e));
    }
  };

  const busy = add.isPending;
  const busyLabel = kind === "file" ? "Uploading & indexing…" : kind === "url" ? "Fetching & indexing…" : "Indexing…";

  return (
    <>
      <DialogHeader>
        <DialogTitle>Add document</DialogTitle>
        <DialogDescription>Documents are stored in your ElevenLabs workspace and can be reused by every agent. The agent answers from them using RAG.</DialogDescription>
      </DialogHeader>
      <DialogBody>
        <Tabs value={kind} onValueChange={(v) => switchKind(v as Kind)}>
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="url" disabled={busy}>
              <Globe /> Website URL
            </TabsTrigger>
            <TabsTrigger value="text" disabled={busy}>
              <Type /> Text
            </TabsTrigger>
            <TabsTrigger value="file" disabled={busy}>
              <Upload /> File
            </TabsTrigger>
          </TabsList>

          <TabsContent value="url" className="flex flex-col gap-4">
            <Field label="Page URL" htmlFor="kb-url" error={errors.url} help="We fetch and index the page. Works best with pricing, FAQ and product pages.">
              <Input id="kb-url" type="url" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://yourcompany.com/pricing" spellCheck={false} disabled={busy} className={cn("font-mono text-[13px]", errors.url && "border-destructive")} />
            </Field>
            <Field label="Name" hint="optional" htmlFor="kb-url-name" error={errors.name} help="Defaults to the page title.">
              <Input id="kb-url-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Pricing page" maxLength={120} disabled={busy} />
            </Field>
          </TabsContent>

          <TabsContent value="text" className="flex flex-col gap-4">
            <Field label="Name" htmlFor="kb-text-name" error={errors.name}>
              <Input id="kb-text-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="FAQ — refunds & cancellations" maxLength={120} disabled={busy} className={errors.name ? "border-destructive" : undefined} />
            </Field>
            <Field
              label="Content"
              htmlFor="kb-text"
              error={errors.text}
              help={
                <span className="flex items-center justify-between gap-4">
                  <span>FAQs, pricing, policies, scripts — anything the agent should be able to quote.</span>
                  <span className="shrink-0 tabular-nums">{text.length.toLocaleString()} chars</span>
                </span>
              }
            >
              <Textarea id="kb-text" rows={12} value={text} onChange={(e) => setText(e.target.value)} placeholder={"Q: Can I cancel after the trial?\nA: Yes — cancel any time from Settings → Billing. No fees."} disabled={busy} spellCheck={false} className={cn("min-h-[240px] font-mono text-[13px] leading-relaxed", errors.text && "border-destructive")} />
            </Field>
          </TabsContent>

          <TabsContent value="file" className="flex flex-col gap-4">
            <input
              ref={inputRef}
              id="kb-file"
              type="file"
              accept={ACCEPT}
              className="sr-only"
              disabled={busy}
              onChange={(e) => {
                pick(e.target.files?.[0]);
                e.target.value = "";
              }}
            />
            {file ? (
              <div className="flex items-center gap-3 rounded-lg border border-border bg-muted/30 px-4 py-3">
                <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-accent-tint text-primary-hover">
                  <FileText className="size-4" strokeWidth={1.8} />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[13px] font-medium" title={file.name}>
                    {file.name}
                  </div>
                  <div className="text-xs text-muted-foreground">{formatBytes(file.size)}</div>
                </div>
                {busy ? (
                  <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Loader2 className="size-3.5 animate-spin text-primary" /> {busyLabel}
                  </span>
                ) : (
                  <>
                    <Button type="button" variant="outline" size="xs" onClick={() => inputRef.current?.click()}>
                      Change
                    </Button>
                    <Button type="button" variant="ghost" size="icon-sm" onClick={() => setFile(null)} aria-label="Remove file">
                      <X />
                    </Button>
                  </>
                )}
              </div>
            ) : (
              <div
                onDragOver={(e) => {
                  e.preventDefault();
                  setDragging(true);
                }}
                onDragLeave={() => setDragging(false)}
                onDrop={onDrop}
                onClick={() => inputRef.current?.click()}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => (e.key === "Enter" || e.key === " " ? inputRef.current?.click() : undefined)}
                className={cn(
                  "flex cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border border-dashed px-4 py-9 text-center transition-colors",
                  dragging ? "border-primary bg-accent-tint/30" : "border-border bg-muted/30 hover:bg-muted/50",
                  (errors.file || fileError) && "border-destructive"
                )}
              >
                <div className="flex size-10 items-center justify-center rounded-xl border border-border bg-card">
                  <Upload className="size-4 text-primary" strokeWidth={1.8} />
                </div>
                <p className="text-[13px]">
                  Drag &amp; drop or <span className="text-primary underline-offset-2 hover:underline">browse</span>
                </p>
                <p className="text-xs text-muted-foreground">PDF, DOCX, TXT, HTML or EPUB · up to 25 MB</p>
              </div>
            )}
            {fileError || errors.file ? <p className="-mt-2 text-xs text-destructive">{fileError ?? errors.file}</p> : null}
            <Field label="Name" hint="optional" htmlFor="kb-file-name" error={errors.name} help="Defaults to the file name.">
              <Input id="kb-file-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Product brochure 2026" maxLength={120} disabled={busy} />
            </Field>
          </TabsContent>
        </Tabs>
        {submitError ? <p className="mt-3 rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs text-destructive">{submitError}</p> : null}
      </DialogBody>
      <DialogFooter>
        <span className="mr-auto text-xs text-muted-foreground">{busy ? busyLabel : "Indexing takes a few seconds."}</span>
        <Button type="button" variant="outline" onClick={onClose} disabled={busy}>
          Cancel
        </Button>
        <Button type="button" onClick={submit} loading={busy}>
          {busy ? busyLabel : "Add document"}
        </Button>
      </DialogFooter>
    </>
  );
}

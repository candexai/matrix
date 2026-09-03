"use client";
import { useEffect, useRef, useState } from "react";
import { AudioLines, CircleAlert, Loader2, Pause, Play, Volume2, VolumeX } from "lucide-react";
import { Slider } from "@/components/ui/slider";
import { formatDuration } from "@/lib/utils";

/** Custom controls around a native <audio> that streams from the backend. */
export function AudioPlayer({ src, fallbackDuration }: { src: string; fallbackDuration?: number }) {
  const ref = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  const [buffering, setBuffering] = useState(false);
  const [current, setCurrent] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [muted, setMuted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setPlaying(false);
    setBuffering(false);
    setCurrent(0);
    setDuration(0);
    setError(null);
  }, [src]);

  const total = duration > 0 ? duration : fallbackDuration ?? 0;

  const toggle = async () => {
    const a = ref.current;
    if (!a) return;
    if (a.paused) {
      try {
        setBuffering(true);
        await a.play();
      } catch {
        setError("Couldn't play this recording.");
      } finally {
        setBuffering(false);
      }
    } else {
      a.pause();
    }
  };
  const seek = (v: number) => {
    const a = ref.current;
    if (!a) return;
    a.currentTime = v;
    setCurrent(v);
  };
  const changeVolume = (v: number) => {
    const a = ref.current;
    setVolume(v);
    setMuted(v === 0);
    if (a) {
      a.volume = v;
      a.muted = v === 0;
    }
  };
  const toggleMute = () => {
    const a = ref.current;
    const next = !muted;
    setMuted(next);
    if (a) a.muted = next;
  };
  const captureDuration = (el: HTMLAudioElement) => {
    if (Number.isFinite(el.duration) && el.duration > 0) setDuration(el.duration);
  };

  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <audio
        ref={ref}
        src={src}
        preload="metadata"
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onEnded={() => setPlaying(false)}
        onPlaying={() => setBuffering(false)}
        onWaiting={() => setBuffering(true)}
        onCanPlay={() => setBuffering(false)}
        onTimeUpdate={(e) => setCurrent(e.currentTarget.currentTime)}
        onLoadedMetadata={(e) => captureDuration(e.currentTarget)}
        onDurationChange={(e) => captureDuration(e.currentTarget)}
        onError={() => setError("Recording unavailable — it may still be processing on ElevenLabs.")}
      />
      <div className="mb-3 flex items-center gap-2 text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground">
        <AudioLines className="size-3.5 text-primary" /> Recording
      </div>
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={toggle}
          disabled={Boolean(error)}
          aria-label={playing ? "Pause" : "Play"}
          className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-sm transition-colors hover:bg-primary-hover disabled:opacity-50"
        >
          {buffering ? <Loader2 className="size-4 animate-spin" /> : playing ? <Pause className="size-4" /> : <Play className="size-4 translate-x-px" />}
        </button>
        <span className="w-11 text-right text-xs tabular-nums text-muted-foreground">{formatDuration(current)}</span>
        <Slider value={[Math.min(current, total || current)]} max={total || 1} step={0.1} disabled={!total || Boolean(error)} onValueChange={([v]) => seek(v)} className="flex-1" aria-label="Seek" />
        <span className="w-11 text-xs tabular-nums text-muted-foreground">{formatDuration(total)}</span>
        <div className="flex items-center gap-2 border-l border-border pl-3">
          <button type="button" onClick={toggleMute} aria-label={muted ? "Unmute" : "Mute"} className="text-muted-foreground transition-colors hover:text-foreground">
            {muted || volume === 0 ? <VolumeX className="size-4" /> : <Volume2 className="size-4" />}
          </button>
          <Slider value={[muted ? 0 : volume]} max={1} step={0.05} onValueChange={([v]) => changeVolume(v)} className="w-20" aria-label="Volume" />
        </div>
      </div>
      {error ? (
        <p className="mt-3 flex items-center gap-1.5 text-xs text-destructive">
          <CircleAlert className="size-3.5" /> {error}
        </p>
      ) : null}
    </div>
  );
}

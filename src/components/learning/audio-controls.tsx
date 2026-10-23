"use client";

import { Mic, Square, Turtle, Volume2 } from "lucide-react";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { Button } from "@/components/ui/button";
import { speak, speechSupported, stopSpeaking } from "@/lib/speech";

const noopSubscribe = () => () => undefined;

function useCapability(check: () => boolean) {
  return useSyncExternalStore(noopSubscribe, check, () => true);
}

const recordingSupported = () => Boolean(navigator.mediaDevices?.getUserMedia) && typeof MediaRecorder !== "undefined";

export function SpeakButton({
  text,
  label = "Listen",
  slow = false,
  size = "sm",
  lang = "en-US",
}: {
  text: string;
  label?: string;
  slow?: boolean;
  size?: "sm" | "md" | "lg";
  lang?: string;
}) {
  const [playing, setPlaying] = useState(false);
  const supported = useCapability(speechSupported);
  useEffect(() => () => stopSpeaking(), []);
  if (!supported) return null;
  return (
    <Button
      type="button"
      variant="soft"
      size={size}
      aria-label={`${label}: computer voice`}
      onClick={() => {
        setPlaying(true);
        speak(text, { lang, rate: slow ? 0.6 : undefined, onEnd: () => setPlaying(false) });
      }}
      className={playing ? "ring-2 ring-sakura-300" : undefined}
    >
      {slow ? <Turtle size={18} /> : <Volume2 size={18} />} {label}
    </Button>
  );
}

export function ListeningPlayer({ text, lang = "en-US" }: { text: string; lang?: string }) {
  const supported = useCapability(speechSupported);
  if (!supported) {
    return (
      <div className="rounded-2xl bg-sky-100 p-4 text-sm">
        Your browser can&apos;t play speech, so here is the sentence to read instead:
        <p className="mt-2 font-display text-lg">“{text}”</p>
      </div>
    );
  }
  return (
    <div className="flex flex-col items-center gap-2 rounded-3xl bg-sky-100/70 p-4">
      <div className="flex gap-2">
        <SpeakButton text={text} label="Play" size="lg" lang={lang} />
        <SpeakButton text={text} label="Slow" slow size="lg" lang={lang} />
      </div>
      <p className="text-center text-xs text-cocoa-400">Computer voice (text-to-speech), not a native speaker recording.</p>
    </div>
  );
}

export function RecordYourself({ prompt }: { prompt: string }) {
  const [state, setState] = useState<"idle" | "recording" | "ready" | "denied">("idle");
  const supported = useCapability(recordingSupported);
  const [url, setUrl] = useState<string | null>(null);
  const recorder = useRef<MediaRecorder | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (timer.current) clearTimeout(timer.current);
      recorder.current?.stream.getTracks().forEach((t) => t.stop());
    };
  }, []);

  useEffect(() => () => {
    if (url) URL.revokeObjectURL(url);
  }, [url]);

  async function start() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const chunks: Blob[] = [];
      const rec = new MediaRecorder(stream);
      rec.ondataavailable = (e) => chunks.push(e.data);
      rec.onstop = () => {
        stream.getTracks().forEach((t) => t.stop());
        setUrl(URL.createObjectURL(new Blob(chunks, { type: rec.mimeType })));
        setState("ready");
      };
      recorder.current = rec;
      rec.start();
      setState("recording");
      timer.current = setTimeout(() => rec.state === "recording" && rec.stop(), 8000);
    } catch {
      setState("denied");
    }
  }

  if (!supported) return null;
  return (
    <div className="rounded-2xl bg-white/70 p-3">
      <p className="text-sm font-semibold">Say it yourself</p>
      <p className="text-xs text-cocoa-400">Record “{prompt}” and compare with the computer voice. Recordings stay on your device and are not scored.</p>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        {state === "recording" ? (
          <Button size="sm" variant="danger" onClick={() => recorder.current?.stop()}>
            <Square size={14} /> Stop
          </Button>
        ) : (
          <Button size="sm" variant="secondary" onClick={start}>
            <Mic size={14} /> {state === "ready" ? "Record again" : "Record"}
          </Button>
        )}
        {url ? <audio src={url} controls className="h-9 max-w-full" /> : null}
        {state === "denied" ? <span className="text-xs text-rose-err">Microphone permission was denied.</span> : null}
      </div>
    </div>
  );
}

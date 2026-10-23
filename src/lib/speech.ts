"use client";

export function speechSupported() {
  return typeof window !== "undefined" && "speechSynthesis" in window && typeof SpeechSynthesisUtterance !== "undefined";
}

function pickVoice(lang: string) {
  const voices = window.speechSynthesis.getVoices();
  const base = lang.slice(0, 2);
  const normalized = (v: SpeechSynthesisVoice) => v.lang.replace("_", "-");
  return (
    voices.find((v) => normalized(v) === lang && /natural|samantha|google|tingting|xiaoxiao/i.test(v.name)) ??
    voices.find((v) => normalized(v) === lang) ??
    voices.find((v) => normalized(v).startsWith(base))
  );
}

export function speak(text: string, options: { rate?: number; lang?: string; onEnd?: () => void } = {}) {
  if (!speechSupported()) return false;
  window.speechSynthesis.cancel();
  const lang = options.lang ?? "en-US";
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = lang;
  utterance.rate = options.rate ?? (lang.startsWith("zh") ? 0.85 : 0.92);
  const voice = pickVoice(lang);
  if (voice) utterance.voice = voice;
  if (options.onEnd) {
    utterance.onend = options.onEnd;
    utterance.onerror = options.onEnd;
  }
  window.speechSynthesis.speak(utterance);
  return true;
}

export function stopSpeaking() {
  if (speechSupported()) window.speechSynthesis.cancel();
}

import { useEffect, useState } from "react";
import * as Speech from "expo-speech";
import type { Lang } from "@/src/api";

export const TTS_LANG: Record<Lang, string> = { en: "en-US", hi: "hi-IN", hng: "hi-IN" };

let speaking = false;
let paused = false;
const listeners = new Set<() => void>();
function emit(v: boolean, p = false) {
  speaking = v;
  paused = p;
  listeners.forEach((l) => l());
}

export function speakText(
  text: string,
  opts: { lang: Lang; rate?: number; voice?: string; whisper?: boolean },
) {
  try {
    Speech.stop();
  } catch {
    /* ignore */
  }
  emit(true);
  Speech.speak(text, {
    language: TTS_LANG[opts.lang] || "en-US",
    rate: opts.whisper ? 0.8 : opts.rate && opts.rate > 0 ? opts.rate : 0.95,
    pitch: opts.whisper ? 0.9 : 1.02,
    volume: opts.whisper ? 0.45 : 1.0,
    voice: opts.voice || undefined,
    onDone: () => emit(false),
    onStopped: () => {
      // keep "speaking" true while paused so resume works
      if (!paused) emit(false);
    },
    onError: () => emit(false),
  });
}

export function stopSpeak() {
  try {
    Speech.stop();
  } catch {
    /* ignore */
  }
  emit(false);
}

/** Pause spoken audio. Supported on iOS + web; returns false elsewhere (caller should stop instead). */
export function pauseSpeak(): boolean {
  try {
    if (!speaking) return false;
    Speech.pause();
    emit(true, true);
    return true;
  } catch {
    return false;
  }
}

/** Resume paused audio. Returns false when unsupported. */
export function resumeSpeak(): boolean {
  try {
    if (!paused) return false;
    Speech.resume();
    emit(true, false);
    return true;
  } catch {
    return false;
  }
}

export function isPaused() {
  return paused;
}

export async function listVoices(lang: Lang): Promise<Speech.Voice[]> {
  try {
    const all = await Speech.getAvailableVoicesAsync();
    const prefix = (TTS_LANG[lang] || "en").slice(0, 2);
    const matched = all.filter((v) => (v.language || "").toLowerCase().startsWith(prefix));
    return (matched.length ? matched : all).slice(0, 12);
  } catch {
    return [];
  }
}

export function useSpeaking() {
  const [v, setV] = useState(speaking);
  useEffect(() => {
    const cb = () => setV(speaking);
    listeners.add(cb);
    return () => {
      listeners.delete(cb);
    };
  }, []);
  return v;
}

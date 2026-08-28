import { useEffect, useState } from "react";
import * as Speech from "expo-speech";
import type { Lang } from "@/src/api";

export const TTS_LANG: Record<Lang, string> = { en: "en-US", hi: "hi-IN", hng: "hi-IN" };

let speaking = false;
const listeners = new Set<() => void>();
function emit(v: boolean) {
  speaking = v;
  listeners.forEach((l) => l());
}

export function speakText(text: string, opts: { lang: Lang; rate?: number; voice?: string }) {
  try {
    Speech.stop();
  } catch {
    /* ignore */
  }
  emit(true);
  Speech.speak(text, {
    language: TTS_LANG[opts.lang] || "en-US",
    rate: opts.rate && opts.rate > 0 ? opts.rate : 0.95,
    pitch: 1.02,
    voice: opts.voice || undefined,
    onDone: () => emit(false),
    onStopped: () => emit(false),
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

import { useEffect, useState } from "react";
import { Platform } from "react-native";
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

// ======================================================================
// WEB ENGINE — talks to window.speechSynthesis directly.
// Why not expo-speech on web? Chrome silently stops long utterances
// (~15s) on remote voices. We fix it by (a) chunking text into sentence
// groups and (b) a pause/resume keep-alive nudge while speaking.
// ======================================================================
const isWeb = Platform.OS === "web";

function webSynth(): SpeechSynthesis | null {
  if (typeof window === "undefined") return null;
  return (window as any).speechSynthesis || null;
}

function splitChunks(text: string, max = 200): string[] {
  const sentences = text.match(/[^.!?।]+[.!?।]*\s*/g) || [text];
  const chunks: string[] = [];
  let cur = "";
  for (const s of sentences) {
    if ((cur + s).length > max && cur) {
      chunks.push(cur.trim());
      cur = s;
    } else {
      cur += s;
    }
  }
  if (cur.trim()) chunks.push(cur.trim());
  return chunks.length ? chunks : [text];
}

let cachedVoices: SpeechSynthesisVoice[] = [];
if (isWeb) {
  const synth = webSynth();
  try {
    cachedVoices = synth?.getVoices() || [];
    synth?.addEventListener?.("voiceschanged", () => {
      cachedVoices = synth.getVoices() || [];
    });
  } catch {
    /* ignore */
  }
}

function pickWebVoice(langCode: string): SpeechSynthesisVoice | null {
  const synth = webSynth();
  if (!synth) return null;
  if (!cachedVoices.length) cachedVoices = synth.getVoices() || [];
  const prefix = langCode.slice(0, 2).toLowerCase();
  const match = cachedVoices.filter((v) => (v.lang || "").toLowerCase().startsWith(prefix));
  if (!match.length) return null;
  // Prefer the higher-quality cloud/neural voices when the browser has them.
  return match.find((v) => /google|natural|neural|premium|enhanced|online/i.test(v.name)) || match[0];
}

let webKeepAlive: ReturnType<typeof setInterval> | null = null;

function webClearKeepAlive() {
  if (webKeepAlive) {
    clearInterval(webKeepAlive);
    webKeepAlive = null;
  }
}

function webStop() {
  webClearKeepAlive();
  try {
    webSynth()?.cancel();
  } catch {
    /* ignore */
  }
}

function webSpeak(text: string, langCode: string, opts: { rate: number; pitch: number; volume: number }) {
  const synth = webSynth();
  if (!synth) {
    emit(false);
    return;
  }
  webStop();
  const voice = pickWebVoice(langCode);
  const chunks = splitChunks(text);
  const finish = () => {
    webClearKeepAlive();
    emit(false);
  };
  chunks.forEach((c, i) => {
    const u = new SpeechSynthesisUtterance(c);
    u.lang = langCode;
    if (voice) u.voice = voice;
    u.rate = opts.rate;
    u.pitch = opts.pitch;
    u.volume = opts.volume;
    if (i === chunks.length - 1) {
      u.onend = finish;
      u.onerror = finish;
    }
    synth.speak(u);
  });
  emit(true);
  // Chrome keep-alive: nudge the engine so long speeches don't cut off.
  webKeepAlive = setInterval(() => {
    if (!paused && synth.speaking) {
      try {
        synth.pause();
        synth.resume();
      } catch {
        /* ignore */
      }
    }
  }, 10000);
}

// ======================================================================
// PUBLIC API (cross-platform)
// ======================================================================
export function speakText(
  text: string,
  opts: { lang: Lang; rate?: number; voice?: string; whisper?: boolean },
) {
  const langCode = TTS_LANG[opts.lang] || "en-US";
  const rate = opts.whisper ? 0.82 : opts.rate && opts.rate > 0 ? opts.rate : 0.95;
  const pitch = opts.whisper ? 0.9 : 1.02;
  const volume = opts.whisper ? 0.45 : 1.0;

  if (isWeb) {
    webSpeak(text, langCode, { rate, pitch, volume });
    return;
  }

  try {
    Speech.stop();
  } catch {
    /* ignore */
  }
  emit(true);
  Speech.speak(text, {
    language: langCode,
    rate,
    pitch,
    volume,
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
  if (isWeb) {
    webStop();
    emit(false);
    return;
  }
  try {
    Speech.stop();
  } catch {
    /* ignore */
  }
  emit(false);
}

/** Pause spoken audio. Supported on iOS + web; returns false elsewhere (caller should stop instead). */
export function pauseSpeak(): boolean {
  if (!speaking) return false;
  if (isWeb) {
    try {
      webSynth()?.pause();
      emit(true, true);
      return true;
    } catch {
      return false;
    }
  }
  try {
    Speech.pause();
    emit(true, true);
    return true;
  } catch {
    return false;
  }
}

/** Resume paused audio. Returns false when unsupported. */
export function resumeSpeak(): boolean {
  if (!paused) return false;
  if (isWeb) {
    try {
      webSynth()?.resume();
      emit(true, false);
      return true;
    } catch {
      return false;
    }
  }
  try {
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

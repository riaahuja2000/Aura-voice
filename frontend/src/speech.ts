import { useEffect, useState } from "react";
import { Platform } from "react-native";
import * as Speech from "expo-speech";
import { setAudioModeAsync } from "expo-audio";
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

const isWeb = Platform.OS === "web";

// ======================================================================
// Shared helpers
// ======================================================================
function cleanSpeechText(text: string): string {
  return String(text || "")
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/[`*_#>|~]/g, " ")
    .replace(/https?:\/\/\S+/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Mobile browser speech engines are much more reliable with short utterances.
 * Split on sentence boundaries first, then hard-wrap very long sentences.
 */
function splitChunks(text: string, max = 135): string[] {
  const cleaned = cleanSpeechText(text);
  if (!cleaned) return [];

  const sentences = cleaned.match(/[^.!?।]+[.!?।]*/g) || [cleaned];
  const chunks: string[] = [];
  let current = "";

  const pushWords = (value: string) => {
    const words = value.trim().split(/\s+/).filter(Boolean);
    let piece = "";
    for (const word of words) {
      const candidate = piece ? `${piece} ${word}` : word;
      if (candidate.length > max && piece) {
        chunks.push(piece.trim());
        piece = word;
      } else {
        piece = candidate;
      }
    }
    if (piece.trim()) return piece.trim();
    return "";
  };

  for (const sentence of sentences) {
    const s = sentence.trim();
    if (!s) continue;

    if (s.length > max) {
      if (current.trim()) {
        chunks.push(current.trim());
        current = "";
      }
      const tail = pushWords(s);
      if (tail) current = tail;
      continue;
    }

    const candidate = current ? `${current} ${s}` : s;
    if (candidate.length > max && current) {
      chunks.push(current.trim());
      current = s;
    } else {
      current = candidate;
    }
  }

  if (current.trim()) chunks.push(current.trim());
  return chunks.filter(Boolean);
}

// ======================================================================
// WEB ENGINE
// ======================================================================
function webSynth(): SpeechSynthesis | null {
  if (typeof window === "undefined") return null;
  return (window as any).speechSynthesis || null;
}

function webUtteranceCtor(): typeof SpeechSynthesisUtterance | null {
  if (typeof window === "undefined") return null;
  return (window as any).SpeechSynthesisUtterance || null;
}

function isMobileBrowser(): boolean {
  if (typeof navigator === "undefined") return false;
  return /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent || "");
}

let cachedVoices: SpeechSynthesisVoice[] = [];
let webRunId = 0;
let webTimer: ReturnType<typeof setTimeout> | null = null;
let webWatchdog: ReturnType<typeof setTimeout> | null = null;
let webPrimed = false;

function clearWebTimers() {
  if (webTimer) {
    clearTimeout(webTimer);
    webTimer = null;
  }
  if (webWatchdog) {
    clearTimeout(webWatchdog);
    webWatchdog = null;
  }
}

function refreshWebVoices() {
  try {
    cachedVoices = webSynth()?.getVoices() || [];
  } catch {
    cachedVoices = [];
  }
}

if (isWeb) {
  refreshWebVoices();
  try {
    webSynth()?.addEventListener?.("voiceschanged", refreshWebVoices);
  } catch {
    /* ignore */
  }
}

/**
 * Prefer a local voice on phones/tablets. Remote/cloud voices exposed by
 * Android Chrome can exist in getVoices() but still fail silently when the
 * microphone has just been used. Desktop can safely prefer enhanced voices.
 */
function pickWebVoice(langCode: string): SpeechSynthesisVoice | null {
  const synth = webSynth();
  if (!synth) return null;
  if (!cachedVoices.length) refreshWebVoices();

  const prefix = langCode.slice(0, 2).toLowerCase();
  const matches = cachedVoices.filter((v) => (v.lang || "").toLowerCase().startsWith(prefix));
  if (!matches.length) return null;

  if (isMobileBrowser()) {
    return matches.find((v) => v.localService) || null;
  }

  return (
    matches.find((v) => /natural|neural|premium|enhanced/i.test(v.name)) ||
    matches.find((v) => v.localService) ||
    matches[0]
  );
}

/**
 * Prime speech synthesis from a real user gesture. This is harmless/silent,
 * but prevents mobile browsers from treating the later oracle reply (after an
 * async network request) as unsolicited audio.
 */
export function primeSpeech() {
  if (!isWeb || webPrimed) return;
  const synth = webSynth();
  const Ctor = webUtteranceCtor();
  if (!synth || !Ctor) return;

  try {
    const u = new Ctor("\u200B");
    u.volume = 0;
    u.rate = 1;
    synth.speak(u);
    webPrimed = true;
  } catch {
    /* A later real utterance will retry. */
  }
}

// Prime on the first trusted browser interaction, without changing the UI.
if (isWeb && typeof document !== "undefined") {
  const primeOnce = () => {
    primeSpeech();
    document.removeEventListener("pointerdown", primeOnce, true);
    document.removeEventListener("touchstart", primeOnce, true);
    document.removeEventListener("keydown", primeOnce, true);
  };
  document.addEventListener("pointerdown", primeOnce, true);
  document.addEventListener("touchstart", primeOnce, true);
  document.addEventListener("keydown", primeOnce, true);
}

function webStop() {
  webRunId += 1;
  clearWebTimers();
  try {
    const synth = webSynth();
    synth?.cancel();
    if (synth?.paused) synth.resume();
  } catch {
    /* ignore */
  }
}

type WebSpeakOpts = { rate: number; pitch: number; volume: number };

function webSpeak(text: string, langCode: string, opts: WebSpeakOpts) {
  const synth = webSynth();
  const Ctor = webUtteranceCtor();
  const chunks = splitChunks(text);

  if (!synth || !Ctor || !chunks.length) {
    emit(false);
    return;
  }

  webStop();
  const runId = webRunId;
  const chosenVoice = pickWebVoice(langCode);
  const mobile = isMobileBrowser();
  emit(true);

  const finish = () => {
    if (runId !== webRunId) return;
    clearWebTimers();
    emit(false);
  };

  const speakChunk = (index: number, retryWithoutVoice = false) => {
    if (runId !== webRunId) return;
    if (paused) return;
    if (index >= chunks.length) {
      finish();
      return;
    }

    const chunk = chunks[index];
    const u = new Ctor(chunk);
    u.lang = langCode;
    // Retry path intentionally leaves voice unset so the OS default wins.
    if (!retryWithoutVoice && chosenVoice) u.voice = chosenVoice;
    u.rate = opts.rate;
    u.pitch = opts.pitch;
    u.volume = opts.volume;

    let started = false;
    let settled = false;

    const clearWatchdog = () => {
      if (webWatchdog) {
        clearTimeout(webWatchdog);
        webWatchdog = null;
      }
    };

    const retryOrContinue = () => {
      if (settled || runId !== webRunId) return;
      settled = true;
      clearWatchdog();

      if (!retryWithoutVoice) {
        try {
          synth.cancel();
          if (synth.paused) synth.resume();
        } catch {
          /* ignore */
        }
        webTimer = setTimeout(() => speakChunk(index, true), mobile ? 180 : 90);
      } else {
        // Never let one broken OS voice strand the whole answer.
        webTimer = setTimeout(() => speakChunk(index + 1, false), 35);
      }
    };

    u.onstart = () => {
      if (runId !== webRunId) return;
      started = true;
      emit(true, false);
      clearWatchdog();
      // A second watchdog catches a browser engine that starts and then hangs.
      const maxSpeakingMs = Math.max(14000, chunk.length * 180);
      webWatchdog = setTimeout(() => {
        if (runId !== webRunId || settled) return;
        try {
          synth.cancel();
        } catch {
          /* ignore */
        }
        retryOrContinue();
      }, maxSpeakingMs);
    };

    u.onend = () => {
      if (settled || runId !== webRunId) return;
      settled = true;
      clearWatchdog();
      webTimer = setTimeout(() => speakChunk(index + 1, false), mobile ? 55 : 20);
    };

    u.onerror = () => retryOrContinue();

    try {
      if (synth.paused) synth.resume();
      synth.speak(u);
    } catch {
      retryOrContinue();
      return;
    }

    // Android Chrome sometimes accepts speak() but never fires onstart.
    // Recover automatically using the device's default voice.
    webWatchdog = setTimeout(() => {
      if (runId !== webRunId || settled || started) return;
      retryOrContinue();
    }, mobile ? 2400 : 1800);
  };

  // Chrome/Android can ignore speak() when it follows cancel() in the same tick.
  webTimer = setTimeout(() => speakChunk(0, false), mobile ? 160 : 70);
}

// ======================================================================
// NATIVE ENGINE
// ======================================================================
let nativeRunId = 0;

async function nativeSpeak(
  text: string,
  langCode: string,
  opts: { rate: number; pitch: number; volume: number; voice?: string },
) {
  const runId = ++nativeRunId;
  const cleaned = cleanSpeechText(text);
  if (!cleaned) {
    emit(false);
    return;
  }

  emit(true);
  try {
    try {
      await Speech.stop();
    } catch {
      /* ignore */
    }

    // Speech recognition can leave the native audio session in recording mode.
    // Reset it to speaker playback before every oracle response.
    try {
      await setAudioModeAsync({ playsInSilentMode: true, allowsRecording: false } as any);
    } catch {
      /* expo-speech can still work even if audio-mode reset is unavailable */
    }

    if (runId !== nativeRunId) return;

    Speech.speak(cleaned, {
      language: langCode,
      rate: opts.rate,
      pitch: opts.pitch,
      volume: opts.volume,
      voice: opts.voice || undefined,
      onStart: () => runId === nativeRunId && emit(true, false),
      onDone: () => runId === nativeRunId && emit(false),
      onStopped: () => {
        if (runId === nativeRunId && !paused) emit(false);
      },
      onError: () => runId === nativeRunId && emit(false),
    });
  } catch {
    if (runId === nativeRunId) emit(false);
  }
}

// ======================================================================
// PUBLIC API
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

  void nativeSpeak(text, langCode, { rate, pitch, volume, voice: opts.voice });
}

export function stopSpeak() {
  if (isWeb) {
    webStop();
    emit(false);
    return;
  }

  nativeRunId += 1;
  try {
    void Speech.stop();
  } catch {
    /* ignore */
  }
  emit(false);
}

/** Pause spoken audio. Supported where the platform exposes pause(). */
export function pauseSpeak(): boolean {
  if (!speaking) return false;

  if (isWeb) {
    try {
      const synth = webSynth();
      if (!synth) return false;
      synth.pause();
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
      const synth = webSynth();
      if (!synth) return false;
      synth.resume();
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
    const prefix = (TTS_LANG[lang] || "en").slice(0, 2).toLowerCase();
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

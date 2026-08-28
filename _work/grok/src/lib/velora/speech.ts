import type { Lang } from "./constants";

type SpeakOpts = {
  onEnd?: () => void;
  onStart?: () => void;
};

let voicesCache: SpeechSynthesisVoice[] = [];
let voicesReady = false;
const voiceWaiters: Array<(v: SpeechSynthesisVoice[]) => void> = [];
let unlocked = false;
let keepAliveTimer: ReturnType<typeof setInterval> | null = null;

function loadVoices(): SpeechSynthesisVoice[] {
  if (typeof window === "undefined" || !window.speechSynthesis) return [];
  const list = window.speechSynthesis.getVoices();
  if (list && list.length > 0) {
    voicesCache = list;
    voicesReady = true;
    voiceWaiters.splice(0).forEach((fn) => fn(voicesCache));
  }
  return voicesCache;
}

if (typeof window !== "undefined" && window.speechSynthesis) {
  loadVoices();
  window.speechSynthesis.onvoiceschanged = loadVoices;
}

function pickVoice(lang: Lang): SpeechSynthesisVoice | null {
  const list = voicesCache.length ? voicesCache : loadVoices();
  if (!list.length) return null;
  const prefix = lang === "hi" ? "hi" : "en";
  const female =
    list.find(
      (v) =>
        v.lang &&
        v.lang.toLowerCase().startsWith(prefix) &&
        /female|woman|samantha|google uk english female|zira|aria|karen|moira|fiona|tessa|alkesh|kalpana|heera|veera|veena/i.test(
          v.name,
        ),
    ) ?? null;
  return (
    female ||
    list.find((v) => v.lang && v.lang.toLowerCase().startsWith(prefix)) ||
    list[0] ||
    null
  );
}

export function hasSpeech(): boolean {
  return typeof window !== "undefined" && "speechSynthesis" in window;
}

export function hasRecognition(): boolean {
  if (typeof window === "undefined") return false;
  const w = window as Window & {
    SpeechRecognition?: unknown;
    webkitSpeechRecognition?: unknown;
  };
  return Boolean(w.SpeechRecognition || w.webkitSpeechRecognition);
}

export function getRecognitionCtor(): (new () => SpeechRecognition) | null {
  if (typeof window === "undefined") return null;
  const w = window as Window & {
    SpeechRecognition?: new () => SpeechRecognition;
    webkitSpeechRecognition?: new () => SpeechRecognition;
  };
  return w.SpeechRecognition || w.webkitSpeechRecognition || null;
}

/** Unlock speechSynthesis on a user gesture (identical to original VELORA). */
export function unlockSpeech() {
  if (!hasSpeech() || unlocked) return;
  try {
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(" ");
    u.volume = 0;
    u.rate = 1;
    u.onend = () => {
      unlocked = true;
    };
    u.onerror = () => {
      unlocked = true;
    };
    window.speechSynthesis.speak(u);
  } catch {
    /* ignore */
  }
}

function clearKeepAlive() {
  if (keepAliveTimer) {
    clearInterval(keepAliveTimer);
    keepAliveTimer = null;
  }
}

function startKeepAlive() {
  clearKeepAlive();
  keepAliveTimer = setInterval(() => {
    if (!window.speechSynthesis) return;
    if (window.speechSynthesis.speaking) {
      try {
        window.speechSynthesis.resume();
      } catch {
        /* ignore */
      }
    } else {
      clearKeepAlive();
    }
  }, 8000);
}

export function speak(text: string, lang: Lang = "en", opts: SpeakOpts = {}) {
  const { onEnd, onStart } = opts;
  if (!hasSpeech()) {
    onEnd?.();
    return null;
  }
  if (!voicesReady) loadVoices();
  const cleaned = String(text)
    .replace(/[*_#`]/g, "")
    .replace(/\s+/g, " ")
    .trim();
  if (!cleaned) {
    onEnd?.();
    return null;
  }
  const u = new SpeechSynthesisUtterance(cleaned);
  u.lang = lang === "hi" ? "hi-IN" : "en-US";
  u.rate = 0.92;
  u.pitch = 1.05;
  u.volume = 1;
  const voice = pickVoice(lang);
  if (voice) u.voice = voice;
  if (onStart) {
    u.onstart = () => {
      startKeepAlive();
      onStart();
    };
  }
  const done = () => {
    clearKeepAlive();
    onEnd?.();
  };
  u.onend = done;
  u.onerror = done;
  const synth = window.speechSynthesis;
  const busy = synth.speaking || synth.pending;
  const go = () => {
    try {
      synth.speak(u);
    } catch {
      done();
    }
  };
  if (busy) {
    try {
      synth.cancel();
    } catch {
      /* ignore */
    }
    setTimeout(go, 60);
  } else {
    go();
  }
  return u;
}

export function cancelSpeech() {
  clearKeepAlive();
  if (!hasSpeech()) return;
  try {
    window.speechSynthesis.cancel();
  } catch {
    /* ignore */
  }
}

export function recognitionLang(lang: Lang): string {
  return lang === "hi" ? "hi-IN" : "en-US";
}

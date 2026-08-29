// Cross-platform Speech-to-Text hook.
// - Native (iOS/Android): uses expo-speech-recognition when available.
// - Web (Expo web preview): uses the browser's Web Speech API.
// Falls back gracefully so the UI never crashes.

import { useCallback, useEffect, useRef, useState } from "react";
import { Platform } from "react-native";
import type { Lang } from "@/src/api";
import { TTS_LANG } from "@/src/speech";

let NativeMod: any = null;
if (Platform.OS !== "web") {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    NativeMod = require("expo-speech-recognition");
  } catch {
    NativeMod = null;
  }
}
const RM = NativeMod?.ExpoSpeechRecognitionModule || null;

function getWebRecognitionCtor(): any {
  if (typeof window === "undefined") return null;
  const w: any = window as any;
  return w.SpeechRecognition || w.webkitSpeechRecognition || null;
}

export function useVoiceSTT(
  lang: Lang,
  onFinalText: (t: string) => void,
  onError?: (code: string) => void,
) {
  const isWeb = Platform.OS === "web";
  const WebCtor = isWeb ? getWebRecognitionCtor() : null;
  const available = isWeb ? !!WebCtor : !!RM;

  const [listening, setListening] = useState(false);
  const textRef = useRef("");
  const webRef = useRef<any>(null);

  // Native listeners
  useEffect(() => {
    if (isWeb || !RM) return;
    const subs: any[] = [];
    try {
      subs.push(
        RM.addListener("result", (e: any) => {
          const t = e?.results?.[0]?.transcript;
          if (typeof t === "string") textRef.current = t;
        }),
      );
      subs.push(
        RM.addListener("end", () => {
          setListening(false);
          const t = textRef.current.trim();
          if (t) onFinalText(t);
        }),
      );
      subs.push(
        RM.addListener("error", (e: any) => {
          setListening(false);
          onError?.(String(e?.error || "error"));
        }),
      );
    } catch {
      /* ignore */
    }
    return () => {
      subs.forEach((s) => {
        try {
          s?.remove?.();
        } catch {
          /* ignore */
        }
      });
    };
  }, [isWeb, onFinalText, onError]);

  const start = useCallback(async () => {
    textRef.current = "";
    if (isWeb) {
      if (!WebCtor) throw new Error("unavailable");
      // Web permission handled by the browser prompt.
      const rec = new WebCtor();
      rec.lang = TTS_LANG[lang] || "en-US";
      rec.interimResults = true;
      rec.continuous = false;
      rec.onresult = (ev: any) => {
        let full = "";
        for (let i = 0; i < ev.results.length; i++) {
          full += ev.results[i][0]?.transcript || "";
        }
        textRef.current = full;
      };
      rec.onend = () => {
        setListening(false);
        const t = textRef.current.trim();
        if (t) onFinalText(t);
      };
      rec.onerror = (ev: any) => {
        setListening(false);
        const code = String(ev?.error || "error");
        // "no-speech"/"aborted" are normal push-to-talk outcomes — not errors.
        if (code !== "no-speech" && code !== "aborted") onError?.(code);
      };
      webRef.current = rec;
      rec.start();
      setListening(true);
      return;
    }
    if (!RM) throw new Error("unavailable");
    const perm = await RM.requestPermissionsAsync();
    if (!perm?.granted) {
      onError?.("not-allowed");
      throw new Error("permission");
    }
    RM.start({ lang: TTS_LANG[lang] || "en-US", interimResults: true, continuous: true });
    setListening(true);
  }, [isWeb, WebCtor, lang, onFinalText, onError]);

  const stop = useCallback(() => {
    if (isWeb) {
      try {
        webRef.current?.stop?.();
      } catch {
        /* ignore */
      }
      setListening(false);
      return;
    }
    try {
      RM?.stop();
    } catch {
      /* ignore */
    }
    setListening(false);
  }, [isWeb]);

  return { available, listening, start, stop };
}

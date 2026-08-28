import { useCallback, useEffect, useRef, useState } from "react";
import type { Lang } from "@/src/api";
import { TTS_LANG } from "@/src/speech";

// expo-speech-recognition is a native module — present only in a dev/prod build,
// not in Expo Go or web. We load it defensively so the app never crashes without it.
let Mod: any = null;
try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  Mod = require("expo-speech-recognition");
} catch {
  Mod = null;
}

const RM = Mod?.ExpoSpeechRecognitionModule || null;

export function useSTT(lang: Lang, onFinalText: (t: string) => void) {
  const [available] = useState<boolean>(!!RM);
  const [listening, setListening] = useState(false);
  const textRef = useRef("");

  useEffect(() => {
    if (!RM) return;
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
      subs.push(RM.addListener("error", () => setListening(false)));
    } catch {
      /* listeners unavailable */
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
  }, [onFinalText]);

  const start = useCallback(async () => {
    if (!RM) throw new Error("unavailable");
    const perm = await RM.requestPermissionsAsync();
    if (!perm?.granted) throw new Error("permission");
    textRef.current = "";
    RM.start({ lang: TTS_LANG[lang] || "en-US", interimResults: true, continuous: true });
    setListening(true);
  }, [lang]);

  const stop = useCallback(() => {
    try {
      RM?.stop();
    } catch {
      /* ignore */
    }
    setListening(false);
  }, []);

  return { available, listening, start, stop };
}

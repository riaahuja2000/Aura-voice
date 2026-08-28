import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { BookOpen, LayoutDashboard, LogOut, Send } from "lucide-react";
import { signOut } from "@/lib/auth/client";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { AnswerCard } from "@/components/velora/answer-card";
import { AuthGuard } from "@/components/velora/guard";
import { BottomNav } from "@/components/velora/bottom-nav";
import { LangSwitcher } from "@/components/velora/lang-switcher";
import { MoonBadge } from "@/components/velora/moon-badge";
import { PhoneShell } from "@/components/velora/phone-shell";
import { VoiceOrb, type VoicePhase } from "@/components/velora/voice-orb";
import { isOwnerEmail } from "@/lib/velora/constants";
import { useI18n } from "@/lib/velora/i18n";
import { consultOracle, ensureOwner } from "@/lib/velora/api";
import {
  cancelSpeech,
  getRecognitionCtor,
  hasRecognition,
  recognitionLang,
  speak,
  unlockSpeech,
} from "@/lib/velora/speech";

export const Route = createFileRoute("/")({ component: HomeRoute });

function HomeRoute() {
  return (
    <AuthGuard>
      <Home />
    </AuthGuard>
  );
}

function Home() {
  const navigate = useNavigate();
  const { t, lang } = useI18n();
  const { user } = useCurrentUserState();
  const owner = isOwnerEmail(user?.primaryEmail);
  const [phase, setPhase] = useState<VoicePhase>("idle");
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState("");
  const [typed, setTyped] = useState("");
  const recRef = useRef<SpeechRecognition | null>(null);

  useEffect(() => {
    void ensureOwner().catch(() => {});
    return () => cancelSpeech();
  }, []);

  const consult = async (text: string) => {
    try {
      setPhase("processing");
      const result = await consultOracle({ data: { question: text, lang } });
      setAnswer(result.answer);
      setPhase("speaking");
      speak(result.answer, lang, { onEnd: () => setPhase("idle") });
    } catch {
      setPhase("error");
    }
  };

  const startListen = () => {
    unlockSpeech();
    const Ctor = getRecognitionCtor();
    if (!Ctor) {
      setPhase("error");
      return;
    }
    const rec = new Ctor();
    rec.lang = recognitionLang(lang);
    rec.continuous = false;
    rec.interimResults = false;
    recRef.current = rec;
    rec.onstart = () => setPhase("listening");
    rec.onresult = (ev) => {
      const transcript = ev.results[0][0].transcript;
      setQuestion(transcript);
      void consult(transcript);
    };
    rec.onerror = () => setPhase("error");
    rec.onend = () => {
      setPhase((p) => (p === "listening" ? "idle" : p));
    };
    rec.start();
  };

  const stopListen = () => {
    recRef.current?.stop();
    setPhase("idle");
  };

  const onOrb = () => {
    unlockSpeech();
    if (phase === "idle" || phase === "error") startListen();
    else if (phase === "listening") stopListen();
    else if (phase === "speaking") {
      cancelSpeech();
      setPhase("idle");
    }
  };

  const reset = () => {
    cancelSpeech();
    setPhase("idle");
    setQuestion("");
    setAnswer("");
    setTyped("");
  };

  const replay = () => {
    if (!answer) return;
    setPhase("speaking");
    speak(answer, lang, { onEnd: () => setPhase("idle") });
  };

  const sendTyped = (e: React.FormEvent) => {
    e.preventDefault();
    const q = typed.trim();
    if (!q) return;
    unlockSpeech();
    setQuestion(q);
    setTyped("");
    void consult(q);
  };

  const logout = async () => {
    cancelSpeech();
    await signOut();
    window.location.href = "/login";
  };

  const caption =
    phase === "idle"
      ? t("tap_to_speak")
      : phase === "listening"
        ? t("listening")
        : phase === "processing"
          ? t("consulting")
          : phase === "speaking"
            ? t("velora_speaks")
            : t("tap_to_try_again");

  const hint =
    phase === "listening"
      ? t("listening_hint")
      : phase === "processing"
        ? t("processing_hint")
        : phase === "speaking"
          ? t("speaking_hint")
          : t("consult_hint");

  return (
    <PhoneShell>
      <div className="flex min-h-dvh flex-col">
        <div className="flex items-center justify-between gap-2 px-5 pt-5">
          <button
            type="button"
            onClick={() => navigate({ to: "/dashboard" })}
            className="flex min-h-11 items-center gap-2 rounded-full border border-gold/30 bg-night/40 px-3 py-2 text-xs font-medium text-gold-soft backdrop-blur-sm transition-all hover:bg-gold/10"
          >
            <BookOpen size={14} />
            <span>{t("my_readings")}</span>
          </button>
          <LangSwitcher />
          <div className="flex items-center gap-2">
            {owner ? (
              <button
                type="button"
                onClick={() => navigate({ to: "/owner" })}
                title={t("owner_dashboard")}
                className="flex h-11 w-11 items-center justify-center rounded-full border border-gold/30 bg-night/40 text-gold-soft transition-all hover:bg-gold/10"
              >
                <LayoutDashboard size={14} />
              </button>
            ) : null}
            <button
              type="button"
              onClick={() => void logout()}
              title={t("logout")}
              className="flex h-11 w-11 items-center justify-center rounded-full border border-gold/30 bg-night/40 text-gold-soft transition-all hover:bg-gold/10"
            >
              <LogOut size={14} />
            </button>
          </div>
        </div>

        <div className="mx-auto flex w-full max-w-sm flex-1 flex-col items-center px-5 pt-5 pb-4">
          <MoonBadge />
          <img
            src="/velora-logo.png"
            alt={t("brand_mark")}
            className="mt-3 mb-1 h-24 w-24 object-contain drop-shadow-2xl"
          />
          <p className="mb-1 font-display text-[11px] tracking-[0.42em] text-gold uppercase shadow-text">
            {t("brand_mark")}
          </p>
          <p className="mb-4 text-[10px] tracking-[0.22em] text-gold/80 uppercase">{t("tagline")}</p>

          {phase === "idle" && !answer ? (
            <div className="mb-5 text-center">
              <p className="mb-2 text-xs font-medium tracking-[0.2em] text-gold-soft uppercase shadow-text-soft">
                {t("private_guidance")}
              </p>
              <h1 className="mb-1 font-display text-3xl leading-snug font-normal text-fg shadow-text">
                {t("what_do_you_need")}
              </h1>
              <h1 className="font-display text-3xl leading-snug font-normal text-gold italic shadow-text">
                {t("clarity_on")}
              </h1>
              <p className="mt-3 px-4 text-xs leading-relaxed text-fg/80 shadow-text-soft">
                {t("tap_once_speak")}
              </p>
            </div>
          ) : null}

          {answer && (phase === "speaking" || phase === "idle") ? (
            <AnswerCard
              answer={answer}
              onReset={reset}
              isSpeaking={phase === "speaking"}
              onToggleSpeak={() => {
                if (phase === "speaking") {
                  cancelSpeech();
                  setPhase("idle");
                } else {
                  replay();
                }
              }}
            />
          ) : null}

          {question && answer ? (
            <p className="mb-3 line-clamp-3 px-2 text-center text-xs leading-relaxed text-fg/70 italic">
              {t("you_asked")}: “{question}”
            </p>
          ) : null}

          {phase === "error" ? (
            <div className="mb-4 w-full rounded-2xl border border-red-400/30 bg-red-500/20 px-5 py-3 text-center backdrop-blur-md">
              <p className="text-sm text-danger">
                {hasRecognition() ? t("couldnt_hear") : t("voice_unsupported")}
              </p>
            </div>
          ) : null}

          <VoiceOrb phase={phase} onClick={onOrb} label={caption} />
          <p className="mt-3 text-xs font-medium tracking-[0.2em] text-gold-soft uppercase shadow-text">
            {caption}
          </p>
          <p className="mt-1 text-[11px] text-fg/60">{hint}</p>

          <form onSubmit={sendTyped} className="mt-6 w-full">
            <p className="mb-2 text-center text-[10px] tracking-[0.18em] text-fg/55 uppercase">
              {t("or_type")}
            </p>
            <div className="flex gap-2">
              <input
                value={typed}
                onChange={(e) => setTyped(e.target.value)}
                placeholder={t("typed_hint")}
                className="h-11 flex-1 rounded-full border border-gold/25 bg-night/50 px-4 text-sm text-fg placeholder:text-fg/40 outline-none focus:border-gold/55"
              />
              <button
                type="submit"
                disabled={!typed.trim() || phase === "processing"}
                className="flex h-11 w-11 items-center justify-center rounded-full bg-gold text-night disabled:opacity-40"
                aria-label={t("send_question")}
              >
                <Send size={16} />
              </button>
            </div>
          </form>

          <p className="mt-4 text-center text-[10px] tracking-[0.16em] text-gold/80 uppercase">
            {t("home_footer")}
          </p>
          <p className="mt-1 px-4 text-center text-[10px] leading-relaxed text-fg/45">
            {t("privacy_note")}
          </p>
        </div>

        <BottomNav isOwner={owner} />
      </div>
    </PhoneShell>
  );
}

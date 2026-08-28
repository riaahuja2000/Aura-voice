import { RotateCcw } from "lucide-react";
import { useI18n } from "@/lib/velora/i18n";

export function AnswerCard({
  onReset,
  isSpeaking,
  onToggleSpeak,
  answer,
}: {
  onReset: () => void;
  isSpeaking: boolean;
  onToggleSpeak: () => void;
  answer: string;
}) {
  const { t } = useI18n();
  return (
    <div className="gold-frame mb-4 w-full overflow-hidden rounded-[28px]">
      <button
        type="button"
        onClick={onToggleSpeak}
        className="flex w-full items-center justify-between border-b border-gold/20 px-5 py-4 active:opacity-80"
      >
        <div className="flex items-center gap-3">
          <span className="flex h-6 items-end gap-1">
            {[0, 1, 2, 3, 4].map((i) => (
              <span
                key={i}
                className="inline-block w-1 rounded-full bg-gold"
                style={{
                  height: isSpeaking ? 14 + ((i * 7) % 12) : 6,
                  opacity: isSpeaking ? 1 : 0.5,
                  animation: isSpeaking
                    ? `velora-eq 0.8s ease-in-out ${i * 0.12}s infinite`
                    : "none",
                }}
              />
            ))}
          </span>
          <p className="text-xs font-semibold tracking-[0.28em] text-gold-soft uppercase shadow-text">
            {t(isSpeaking ? "velora_speaks" : "tap_to_replay")}
          </p>
        </div>
      </button>
      {answer ? (
        <p className="max-h-40 overflow-y-auto px-5 pt-4 text-sm leading-relaxed text-fg/90">
          {answer}
        </p>
      ) : null}
      <div className="px-5 py-3">
        <button
          type="button"
          onClick={onReset}
          className="flex min-h-11 items-center gap-2 text-xs text-gold-soft transition-colors hover:text-gold"
        >
          <RotateCcw size={13} />
          {t("ask_another")}
        </button>
      </div>
    </div>
  );
}

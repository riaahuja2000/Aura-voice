import { useEffect, useRef, useState } from "react";
import { ChevronDown, Languages } from "lucide-react";
import { LANGS } from "@/lib/velora/constants";
import { useI18n } from "@/lib/velora/i18n";

export function LangSwitcher() {
  const { lang, setLang, t } = useI18n();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, []);

  const current = LANGS.find((l) => l.code === lang) ?? LANGS[0]!;

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        aria-label={t("choose_language")}
        onClick={() => setOpen((v) => !v)}
        className="flex min-h-11 items-center gap-1.5 rounded-full border border-gold/35 bg-night/50 px-3 py-2 text-xs font-medium text-gold-soft backdrop-blur-sm transition-all hover:bg-gold/10"
      >
        <Languages size={13} />
        <span>{current.short}</span>
        <ChevronDown
          size={11}
          className={open ? "rotate-180 transition-transform" : "transition-transform"}
        />
      </button>
      {open ? (
        <div className="gold-frame absolute top-full left-1/2 z-50 mt-2 min-w-[148px] -translate-x-1/2 overflow-hidden rounded-2xl">
          {LANGS.map((item) => (
            <button
              key={item.code}
              type="button"
              onClick={() => {
                setLang(item.code);
                setOpen(false);
              }}
              className={`w-full px-4 py-2.5 text-left text-sm transition-colors ${
                lang === item.code
                  ? "bg-gold/20 text-gold-soft"
                  : "text-fg/75 hover:bg-gold/10"
              }`}
            >
              {item.code === "en" ? t("language_en") : item.code === "hi" ? t("language_hi") : t("language_hng")}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

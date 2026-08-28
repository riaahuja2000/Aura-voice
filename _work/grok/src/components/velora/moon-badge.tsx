import { moonGlyph, moonKind } from "@/lib/velora/moon";
import { useI18n, type I18nKey } from "@/lib/velora/i18n";

const KEY: Record<ReturnType<typeof moonKind>, I18nKey> = {
  new: "moon_new",
  waxing: "moon_waxing",
  full: "moon_full",
  waning: "moon_waning",
};

export function MoonBadge() {
  const { t } = useI18n();
  const kind = moonKind();
  return (
    <div className="flex items-center gap-2 rounded-full border border-gold/25 bg-night/40 px-3 py-1.5 text-[10px] tracking-[0.16em] text-gold-soft uppercase">
      <span aria-hidden className="text-sm leading-none">
        {moonGlyph(kind)}
      </span>
      <span>{t("moon_label")}</span>
      <span className="text-fg/70">{t(KEY[kind])}</span>
    </div>
  );
}

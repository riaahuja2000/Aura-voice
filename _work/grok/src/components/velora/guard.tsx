import { RedirectToSignIn } from "@/lib/auth/gates";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { useI18n } from "@/lib/velora/i18n";
import { PhoneShell } from "./phone-shell";

export function AuthGuard({ children }: { children: React.ReactNode }) {
  const { user, isPending } = useCurrentUserState();
  const { t } = useI18n();
  if (isPending) {
    return (
      <PhoneShell>
        <div className="flex min-h-dvh flex-col items-center justify-center px-6 text-center">
          <img src="/velora-logo.png" alt={t("brand_mark")} className="mb-4 h-24 w-24 object-contain" />
          <p className="font-display text-2xl tracking-[0.28em] text-gold uppercase">{t("brand_mark")}</p>
          <p className="mt-2 text-xs tracking-[0.2em] text-white/70 uppercase">{t("loading")}</p>
          <div className="mt-5 h-8 w-8 animate-spin rounded-full border-2 border-gold/40 border-t-gold" />
        </div>
      </PhoneShell>
    );
  }
  if (!user) return <RedirectToSignIn to="/login" />;
  return <>{children}</>;
}

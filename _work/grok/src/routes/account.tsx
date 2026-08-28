import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowLeft, LayoutDashboard, LogOut } from "lucide-react";
import { signOut } from "@/lib/auth/client";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { AuthGuard } from "@/components/velora/guard";
import { BottomNav } from "@/components/velora/bottom-nav";
import { LangSwitcher } from "@/components/velora/lang-switcher";
import { PhoneShell } from "@/components/velora/phone-shell";
import { LANGS, isOwnerEmail } from "@/lib/velora/constants";
import { useI18n } from "@/lib/velora/i18n";
import { getMeProfile } from "@/lib/velora/api";

export const Route = createFileRoute("/account")({ component: AccountRoute });

function AccountRoute() {
  return (
    <AuthGuard>
      <Account />
    </AuthGuard>
  );
}

function Account() {
  const navigate = useNavigate();
  const { t, lang, setLang } = useI18n();
  const { user } = useCurrentUserState();
  const [profile, setProfile] = useState<{
    name: string;
    email: string;
    createdAt: string;
    isOwner: boolean;
    readings: number;
  } | null>(null);

  useEffect(() => {
    void getMeProfile()
      .then(setProfile)
      .catch(() => {});
  }, []);

  const owner = profile?.isOwner || isOwnerEmail(user?.primaryEmail);

  return (
    <PhoneShell veil="strong">
      <div className="flex min-h-dvh flex-col">
        <div className="mx-auto w-full max-w-lg flex-1 px-4 py-6">
          <div className="mb-6 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => navigate({ to: "/" })}
                className="flex h-11 w-11 items-center justify-center rounded-full border border-gold/25 bg-night/40 hover:bg-gold/10"
                aria-label={t("back_home")}
              >
                <ArrowLeft size={18} className="text-gold-soft" />
              </button>
              <div>
                <h1 className="font-display text-xl font-medium text-fg shadow-text">{t("your_account")}</h1>
                <p className="text-xs text-fg/70">{t("account_subtitle")}</p>
              </div>
            </div>
            <LangSwitcher />
          </div>

          <div className="mb-5 flex flex-col items-center">
            <img src="/velora-logo.png" alt={t("brand_mark")} className="mb-3 h-20 w-20 object-contain" />
            <p className="font-display text-2xl text-fg shadow-text">
              {profile?.name || user?.displayName || t("no_name")}
            </p>
            <p className="mt-1 text-sm text-fg/70">{profile?.email || user?.primaryEmail}</p>
            <span className="mt-3 rounded-full border border-gold/40 bg-gold/15 px-3 py-1 text-[10px] tracking-[0.16em] text-gold uppercase">
              {owner ? t("owner_role") : t("customer_role")}
            </span>
          </div>

          <div className="gold-frame mb-4 rounded-[22px] p-4">
            <p className="mb-1 text-[10px] tracking-widest text-gold/60 uppercase">{t("signed_in_as")}</p>
            <p className="text-sm text-fg">{profile?.email || user?.primaryEmail}</p>
            <div className="mt-4 grid grid-cols-2 gap-3">
              <div>
                <p className="text-[10px] tracking-widest text-gold/60 uppercase">{t("total_sessions")}</p>
                <p className="font-display text-xl font-medium text-fg">{profile?.readings ?? 0}</p>
              </div>
              <div>
                <p className="text-[10px] tracking-widest text-gold/60 uppercase">{t("created")}</p>
                <p className="text-sm text-fg/80">
                  {profile?.createdAt
                    ? new Date(profile.createdAt).toLocaleDateString(lang === "hi" ? "hi-IN" : "en-US")
                    : "—"}
                </p>
              </div>
            </div>
            <div className="mt-3">
              <p className="text-[10px] tracking-widest text-gold/60 uppercase">{t("role")}</p>
              <p className="text-sm text-fg">{owner ? t("owner_role") : t("customer_role")}</p>
            </div>
          </div>

          <div className="gold-frame mb-4 rounded-[22px] p-4">
            <p className="mb-3 text-xs font-semibold tracking-widest text-gold-soft uppercase">
              {t("choose_language")}
            </p>
            <p className="mb-3 text-[11px] text-fg/55">{t("account_language_note")}</p>
            <div className="grid grid-cols-3 gap-2">
              {LANGS.map((item) => (
                <button
                  key={item.code}
                  type="button"
                  onClick={() => setLang(item.code)}
                  className={`min-h-11 rounded-xl border px-2 py-3 text-xs transition ${
                    lang === item.code
                      ? "border-gold/55 bg-gold/20 text-gold-soft"
                      : "border-gold/20 bg-night/30 text-fg/70 hover:bg-gold/10"
                  }`}
                >
                  {item.code === "en" ? t("language_en") : item.code === "hi" ? t("language_hi") : t("language_hng")}
                </button>
              ))}
            </div>
            <p className="mt-3 text-[11px] text-fg/50">{t("all_words_live")}</p>
          </div>

          {owner ? (
            <button
              type="button"
              onClick={() => navigate({ to: "/owner" })}
              className="mb-3 flex h-12 w-full items-center justify-center gap-2 rounded-xl border border-gold/30 bg-night/40 text-sm text-gold-soft hover:bg-gold/10"
            >
              <LayoutDashboard size={16} />
              {t("owner_access")}
            </button>
          ) : (
            <button
              type="button"
              onClick={() => navigate({ to: "/dashboard" })}
              className="mb-3 flex h-12 w-full items-center justify-center gap-2 rounded-xl border border-gold/30 bg-night/40 text-sm text-gold-soft hover:bg-gold/10"
            >
              {t("customer_dashboard")}
            </button>
          )}

          <button
            type="button"
            onClick={async () => {
              await signOut();
              window.location.href = "/login";
            }}
            className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-gold text-sm font-medium text-night hover:brightness-110"
          >
            <LogOut size={16} />
            {t("logout")}
          </button>

          <p className="mt-6 text-center text-[10px] tracking-[0.18em] text-gold/80 uppercase">
            {t("tagline")}
          </p>
          <p className="mt-1 text-center text-[10px] text-fg/45">{t("occult_line")}</p>
        </div>
        <BottomNav isOwner={!!owner} />
      </div>
    </PhoneShell>
  );
}

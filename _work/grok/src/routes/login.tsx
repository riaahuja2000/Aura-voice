import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Loader2, Lock, Mail } from "lucide-react";
import { GROK_PROVIDERS, authClient, authEnabled, signIn } from "@/lib/auth/client";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { LangSwitcher } from "@/components/velora/lang-switcher";
import { PhoneShell } from "@/components/velora/phone-shell";
import { useI18n } from "@/lib/velora/i18n";
import { ensureOwner } from "@/lib/velora/api";

export const Route = createFileRoute("/login")({ component: Login });

function Login() {
  const { t } = useI18n();
  const navigate = useNavigate();
  const { user, isPending } = useCurrentUserState();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    void ensureOwner().catch(() => {});
  }, []);

  useEffect(() => {
    if (!isPending && user) navigate({ to: "/" });
  }, [isPending, user, navigate]);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      const { error: err } = await authClient.signIn.email({ email, password });
      if (err) {
        setError(err.message || t("invalid_credentials"));
        return;
      }
      navigate({ to: "/" });
    } catch (err) {
      setError(err instanceof Error ? err.message : t("invalid_credentials"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <PhoneShell veil="strong">
      <div className="flex min-h-dvh flex-col px-5 py-6">
        <div className="mb-6 flex items-center justify-between">
          <img src="/velora-logo.png" alt={t("brand_mark")} className="h-14 w-14 object-contain drop-shadow-2xl" />
          <LangSwitcher />
        </div>
        <div className="mx-auto w-full max-w-sm">
          <p className="mb-1 text-center text-[11px] font-medium tracking-[0.22em] text-gold-soft uppercase shadow-text-soft">
            {t("welcome_back")}
          </p>
          <h1 className="mb-2 text-center font-display text-3xl font-medium text-fg shadow-text">
            {t("log_in_account")}
          </h1>
          <p className="mb-6 text-center text-xs text-fg/65">{t("sign_in_required")}</p>
          {authEnabled ? (
            <div className="mb-4 space-y-2">
              {GROK_PROVIDERS.map((p) => (
                <button
                  key={p.providerId}
                  type="button"
                  onClick={() => signIn(p.providerId, { callbackURL: "/" })}
                  className="flex h-12 w-full items-center justify-center rounded-xl border border-gold/25 bg-night/40 text-sm font-medium text-fg backdrop-blur-sm transition hover:bg-gold/10"
                >
                  {p.providerId.includes("google") ? t("continue_google") : t("continue_x")}
                </button>
              ))}
            </div>
          ) : null}
          <div className="relative my-5">
            <div className="h-px bg-gold/20" />
            <span className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-night/80 px-3 text-[10px] tracking-[0.2em] text-fg/60 uppercase">
              {t("or")}
            </span>
          </div>
          <p className="mb-3 text-center text-[11px] tracking-[0.14em] text-gold/70 uppercase">
            {t("sign_in_email")}
          </p>
          {error ? (
            <div className="mb-3 rounded-lg bg-red-500/20 px-3 py-2 text-sm text-danger">{error}</div>
          ) : null}
          <form onSubmit={onSubmit} className="space-y-3">
            <label className="block text-xs text-fg/80" htmlFor="email">
              {t("email")}
            </label>
            <div className="relative">
              <Mail className="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-gold/60" />
              <input
                id="email"
                type="email"
                autoComplete="email"
                autoFocus
                required
                placeholder={t("email_placeholder")}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="h-12 w-full rounded-xl border border-gold/25 bg-night/50 pr-3 pl-10 text-sm text-fg placeholder:text-fg/40 outline-none focus:border-gold/55"
              />
            </div>
            <label className="block text-xs text-fg/80" htmlFor="password">
              {t("password")}
            </label>
            <div className="relative">
              <Lock className="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-gold/60" />
              <input
                id="password"
                type="password"
                autoComplete="current-password"
                required
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="h-12 w-full rounded-xl border border-gold/25 bg-night/50 pr-3 pl-10 text-sm text-fg placeholder:text-fg/40 outline-none focus:border-gold/55"
              />
            </div>
            <button
              type="submit"
              disabled={busy}
              className="flex h-12 w-full items-center justify-center rounded-xl bg-gold text-sm font-medium text-night transition hover:brightness-110 disabled:opacity-60"
            >
              {busy ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {t("logging_in")}
                </>
              ) : (
                t("log_in")
              )}
            </button>
          </form>
          <p className="mt-6 text-center text-sm text-fg/75">
            {t("dont_have_account")}{" "}
            <Link to="/register" className="font-medium text-gold underline-offset-2 hover:underline">
              {t("create_one")}
            </Link>
          </p>
          <p className="mt-8 text-center text-[10px] tracking-[0.18em] text-gold/80 uppercase">
            {t("tagline")}
          </p>
          <p className="mt-1 text-center text-[10px] text-fg/50">{t("occult_line")}</p>
        </div>
      </div>
    </PhoneShell>
  );
}

import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowLeft, BookOpen, Calendar, Layers, Volume2 } from "lucide-react";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { AuthGuard } from "@/components/velora/guard";
import { BottomNav } from "@/components/velora/bottom-nav";
import { PhoneShell } from "@/components/velora/phone-shell";
import { TopicChip } from "@/components/velora/topic-chip";
import { isOwnerEmail, type Lang } from "@/lib/velora/constants";
import { useI18n } from "@/lib/velora/i18n";
import { listMyReadings } from "@/lib/velora/api";
import { cancelSpeech, speak } from "@/lib/velora/speech";

export const Route = createFileRoute("/dashboard")({ component: DashRoute });

function DashRoute() {
  return (
    <AuthGuard>
      <Dashboard />
    </AuthGuard>
  );
}

type Item = {
  id: number;
  question: string;
  answer: string;
  topics: string[];
  lang: string;
  created_at: string;
};

function Dashboard() {
  const navigate = useNavigate();
  const { t, lang } = useI18n();
  const { user } = useCurrentUserState();
  const owner = isOwnerEmail(user?.primaryEmail);
  const [rows, setRows] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [openId, setOpenId] = useState<number | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const data = await listMyReadings();
        if (alive) setRows(data);
      } catch (err) {
        console.error(err);
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
      cancelSpeech();
    };
  }, []);

  const topics = new Set(rows.flatMap((r) => r.topics));
  const week = rows.filter(
    (r) => new Date(r.created_at).getTime() > Date.now() - 7 * 864e5,
  ).length;
  const stats = [
    { label: t("total_sessions"), value: rows.length, icon: BookOpen },
    { label: t("topics_explored"), value: topics.size, icon: Layers },
    { label: t("this_week"), value: week, icon: Calendar },
  ];

  return (
    <PhoneShell veil="strong">
      <div className="flex min-h-dvh flex-col">
        <div className="mx-auto w-full max-w-lg px-4 py-6">
          <div className="mb-6 flex items-center gap-3">
            <button
              type="button"
              onClick={() => navigate({ to: "/" })}
              className="flex h-11 w-11 items-center justify-center rounded-full border border-gold/25 bg-night/40 hover:bg-gold/10"
              aria-label={t("back_home")}
            >
              <ArrowLeft size={18} className="text-gold-soft" />
            </button>
            <div>
              <h1 className="font-display text-xl font-medium text-fg shadow-text">{t("customer_dashboard")}</h1>
              <p className="text-xs text-fg/70">{t("readings_subtitle")}</p>
            </div>
          </div>

          <p className="mb-3 text-[10px] tracking-[0.18em] text-gold/70 uppercase">
            {t("seeker_journal")}
          </p>

          <div className="mb-6 grid grid-cols-3 gap-3">
            {stats.map((s) => (
              <div key={s.label} className="gold-frame rounded-[22px] p-4 text-center">
                <s.icon size={16} className="mx-auto mb-1 text-gold" />
                <p className="font-display text-lg font-medium text-fg">{s.value}</p>
                <p className="text-[10px] text-fg/75 shadow-text-soft">{s.label}</p>
              </div>
            ))}
          </div>

          <h2 className="mb-3 text-xs font-semibold tracking-widest text-gold-soft uppercase shadow-text">
            {t("recent_sessions")}
          </h2>

          {loading ? (
            <div className="flex justify-center py-12">
              <div className="h-8 w-8 animate-spin rounded-full border-2 border-gold/40 border-t-gold" />
            </div>
          ) : rows.length === 0 ? (
            <div className="gold-frame py-12 text-center rounded-[28px]">
              <p className="text-sm text-fg/70">{t("journal_empty")}</p>
              <button
                type="button"
                onClick={() => navigate({ to: "/" })}
                className="mt-4 min-h-11 rounded-full border border-gold/35 px-6 py-2 text-sm text-gold-soft hover:bg-gold/10"
              >
                {t("ask_velora")}
              </button>
            </div>
          ) : (
            <div className="space-y-3 pb-4">
              {rows.map((r) => {
                const open = openId === r.id;
                return (
                  <div key={r.id} className="gold-frame rounded-[22px] p-4">
                    <p className="mb-1 text-[10px] tracking-widest text-gold/70 uppercase">
                      {new Date(r.created_at).toLocaleDateString(lang === "hi" ? "hi-IN" : "en-US", {
                        month: "short",
                        day: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </p>
                    <p className="mb-2 text-sm font-light text-fg italic">
                      {t("you_asked")}: “{r.question}”
                    </p>
                    <p className={open ? "text-xs leading-relaxed text-fg/80" : "line-clamp-3 text-xs leading-relaxed text-fg/75"}>
                      {r.answer}
                    </p>
                    {r.topics.length > 0 ? (
                      <div className="mt-2 flex flex-wrap gap-1">
                        {r.topics.map((topic) => (
                          <TopicChip key={topic} topic={topic} />
                        ))}
                      </div>
                    ) : null}
                    <div className="mt-3 flex gap-2">
                      <button
                        type="button"
                        onClick={() => setOpenId(open ? null : r.id)}
                        className="min-h-11 rounded-full border border-gold/25 px-3 text-[11px] text-gold-soft"
                      >
                        {open ? t("collapse") : t("expand")}
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          const voiceLang: Lang = r.lang === "hi" || r.lang === "hng" ? r.lang : "en";
                          speak(r.answer, voiceLang);
                        }}
                        className="flex min-h-11 items-center gap-1 rounded-full border border-gold/25 px-3 text-[11px] text-gold-soft"
                      >
                        <Volume2 size={12} />
                        {t("replay_reading")}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
        <BottomNav isOwner={owner} />
      </div>
    </PhoneShell>
  );
}

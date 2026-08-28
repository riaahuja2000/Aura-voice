import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowLeft, BookOpen, Calendar, Layers, Users } from "lucide-react";
import {
  Bar,
  BarChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  Cell,
} from "recharts";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { AuthGuard } from "@/components/velora/guard";
import { BottomNav } from "@/components/velora/bottom-nav";
import { PhoneShell } from "@/components/velora/phone-shell";
import { TopicChip } from "@/components/velora/topic-chip";
import { isOwnerEmail } from "@/lib/velora/constants";
import { useI18n } from "@/lib/velora/i18n";
import { ownerOverview } from "@/lib/velora/api";

export const Route = createFileRoute("/owner")({ component: OwnerRoute });

function OwnerRoute() {
  return (
    <AuthGuard>
      <Owner />
    </AuthGuard>
  );
}

type Overview = Awaited<ReturnType<typeof ownerOverview>>;

const BAR_COLORS = [
  "#e8c36a",
  "#b8892d",
  "#c9d4ff",
  "#f3e0a8",
  "#8a5a2b",
  "#d8c4a0",
  "#9aa8d8",
  "#c4a35a",
];

function Owner() {
  const navigate = useNavigate();
  const { t, topicLabel } = useI18n();
  const { user } = useCurrentUserState();
  const owner = isOwnerEmail(user?.primaryEmail);
  const [data, setData] = useState<Overview | null>(null);
  const [loading, setLoading] = useState(true);
  const [forbidden, setForbidden] = useState(false);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const overview = await ownerOverview();
        if (alive) setData(overview);
      } catch {
        if (alive) setForbidden(true);
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  if (!owner && !loading) {
    return (
      <PhoneShell veil="owner">
        <div className="flex min-h-dvh flex-col items-center justify-center px-6 text-center">
          <p className="text-sm text-fg/80">{t("owner_only")}</p>
          <button
            type="button"
            onClick={() => navigate({ to: "/" })}
            className="mt-4 min-h-11 rounded-full border border-gold/30 px-6 py-2 text-sm text-gold-soft"
          >
            {t("back_home")}
          </button>
          <BottomNav isOwner={false} />
        </div>
      </PhoneShell>
    );
  }

  const stats = data
    ? [
        { label: t("total_sessions"), value: data.totalSessions, icon: BookOpen },
        { label: t("registered_users"), value: data.registeredUsers, icon: Users },
        { label: t("today"), value: data.today, icon: Calendar },
        { label: t("topics_covered"), value: data.topicsCovered, icon: Layers },
      ]
    : [];

  const chartData = (data?.mostAsked ?? []).map((row) => ({
    ...row,
    label: topicLabel(row.name),
  }));

  return (
    <PhoneShell veil="owner">
      <div className="flex min-h-dvh flex-col">
        <div className="mx-auto w-full max-w-2xl px-4 py-6">
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
              <h1 className="font-display text-xl font-medium text-fg shadow-text">{t("owner_dashboard")}</h1>
              <p className="text-xs text-fg/70">{t("analytics")}</p>
            </div>
          </div>

          {loading ? (
            <div className="flex justify-center py-16">
              <div className="h-8 w-8 animate-spin rounded-full border-2 border-gold/40 border-t-gold" />
            </div>
          ) : forbidden || !data ? (
            <p className="py-12 text-center text-sm text-fg/70">{t("owner_only")}</p>
          ) : (
            <>
              <p className="mb-3 text-[10px] tracking-[0.18em] text-gold/70 uppercase">{t("temple_pulse")}</p>
              <div className="mb-6 grid grid-cols-2 gap-3">
                {stats.map((s) => (
                  <div key={s.label} className="gold-frame rounded-[22px] p-4">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gold/15">
                        <s.icon size={18} className="text-gold" />
                      </div>
                      <div>
                        <p className="font-display text-2xl font-medium text-fg">{s.value}</p>
                        <p className="text-xs text-fg/75">{s.label}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <div className="gold-frame mb-4 rounded-[22px] p-5">
                <h2 className="mb-4 text-xs font-semibold tracking-widest text-gold-soft uppercase">
                  {t("sessions_7days")}
                </h2>
                {data.last7.every((d) => d.count === 0) ? (
                  <p className="py-6 text-center text-xs text-fg/55">{t("empty_chart")}</p>
                ) : (
                  <div className="h-[120px] w-full">
                    <ResponsiveContainer width="100%" height={120}>
                      <BarChart data={data.last7}>
                        <XAxis
                          dataKey="label"
                          tick={{ fill: "rgba(246,239,226,0.55)", fontSize: 11 }}
                          axisLine={false}
                          tickLine={false}
                        />
                        <YAxis hide />
                        <Tooltip
                          contentStyle={{
                            background: "rgba(10,6,24,0.92)",
                            border: "1px solid rgba(232,195,106,0.3)",
                            borderRadius: 8,
                            color: "#f6efe2",
                            fontSize: 12,
                          }}
                        />
                        <Bar dataKey="count" radius={[6, 6, 0, 0]}>
                          {data.last7.map((_, i) => (
                            <Cell key={i} fill="#e8c36a" fillOpacity={0.85} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </div>

              {chartData.length > 0 ? (
                <div className="gold-frame mb-4 rounded-[22px] p-5">
                  <h2 className="mb-4 text-xs font-semibold tracking-widest text-gold-soft uppercase">
                    {t("most_asked")}
                  </h2>
                  <div className="h-[140px] w-full">
                    <ResponsiveContainer width="100%" height={140}>
                      <BarChart data={chartData} layout="vertical">
                        <XAxis type="number" hide />
                        <YAxis
                          type="category"
                          dataKey="label"
                          tick={{ fill: "rgba(246,239,226,0.7)", fontSize: 11 }}
                          axisLine={false}
                          tickLine={false}
                          width={88}
                        />
                        <Tooltip
                          contentStyle={{
                            background: "rgba(10,6,24,0.92)",
                            border: "1px solid rgba(232,195,106,0.3)",
                            borderRadius: 8,
                            color: "#f6efe2",
                            fontSize: 12,
                          }}
                        />
                        <Bar dataKey="count" radius={[0, 6, 6, 0]}>
                          {chartData.map((_, i) => (
                            <Cell key={i} fill={BAR_COLORS[i % BAR_COLORS.length]} fillOpacity={0.9} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              ) : null}

              <h2 className="mb-3 text-xs font-semibold tracking-widest text-gold-soft uppercase">
                {t("members")}
              </h2>
              <div className="mb-4 space-y-2">
                {data.members.length === 0 ? (
                  <p className="text-sm text-fg/60">{t("no_members")}</p>
                ) : (
                  data.members.slice(0, 8).map((m) => (
                    <div key={m.id} className="gold-frame rounded-xl p-3">
                      <div className="flex items-center justify-between gap-2">
                        <div>
                          <p className="text-sm text-fg">{m.name || t("no_name")}</p>
                          <p className="text-[11px] text-fg/50">{m.email}</p>
                        </div>
                        <span className="rounded-full bg-gold/15 px-2 py-0.5 text-[10px] text-gold">
                          {m.isOwner ? t("owner_role") : t("customer_role")}
                        </span>
                      </div>
                    </div>
                  ))
                )}
              </div>

              <h2 className="mb-3 text-xs font-semibold tracking-widest text-gold-soft uppercase">
                {t("recent_sessions")}
              </h2>
              {data.recent.length === 0 ? (
                <p className="py-8 text-center text-sm text-fg/60">{t("empty_owner")}</p>
              ) : (
                <div className="space-y-2 pb-4">
                  {data.recent.map((r) => (
                    <div key={r.id} className="gold-frame rounded-xl p-3">
                      <div className="flex items-start justify-between gap-2">
                        <p className="line-clamp-1 flex-1 text-xs text-fg/80 italic">
                          “{r.question}”
                        </p>
                        <p className="shrink-0 text-[10px] text-fg/50">
                          {new Date(r.created_at).toLocaleDateString("en-US", {
                            month: "short",
                            day: "numeric",
                          })}
                        </p>
                      </div>
                      <div className="mt-1 flex flex-wrap gap-1">
                        {r.topics.map((topic) => (
                          <TopicChip key={topic} topic={topic} />
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
        <BottomNav isOwner={owner} />
      </div>
    </PhoneShell>
  );
}

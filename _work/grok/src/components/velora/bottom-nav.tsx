import { Link, useRouterState } from "@tanstack/react-router";
import { BookOpen, Home, LayoutDashboard, UserRound } from "lucide-react";
import { useI18n } from "@/lib/velora/i18n";

export function BottomNav({ isOwner }: { isOwner: boolean }) {
  const { t } = useI18n();
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  const items = [
    { to: "/", label: t("nav_home"), icon: Home, match: (p: string) => p === "/" },
    {
      to: "/dashboard",
      label: t("nav_readings"),
      icon: BookOpen,
      match: (p: string) => p.startsWith("/dashboard"),
    },
    {
      to: "/account",
      label: t("nav_account"),
      icon: UserRound,
      match: (p: string) => p.startsWith("/account"),
    },
    ...(isOwner
      ? [
          {
            to: "/owner",
            label: t("nav_owner"),
            icon: LayoutDashboard,
            match: (p: string) => p.startsWith("/owner"),
          },
        ]
      : []),
  ];

  return (
    <nav className="sticky bottom-0 z-30 mt-auto px-3 pb-[max(12px,env(safe-area-inset-bottom))] pt-2">
      <div
        className="grid rounded-full border border-gold/25 p-1"
        style={{
          gridTemplateColumns: `repeat(${items.length}, minmax(0, 1fr))`,
          background: "rgba(10, 6, 24, 0.78)",
          backdropFilter: "blur(18px)",
        }}
      >
        {items.map((item) => {
          const active = item.match(pathname);
          const Icon = item.icon;
          return (
            <Link
              key={item.to}
              to={item.to}
              className={`flex min-h-11 flex-col items-center justify-center gap-0.5 rounded-full px-2 py-1.5 text-[10px] tracking-wide uppercase transition-colors ${
                active ? "bg-gold/18 text-gold-soft" : "text-fg/65 hover:text-fg"
              }`}
            >
              <Icon size={16} />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

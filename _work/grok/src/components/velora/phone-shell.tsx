import type { ReactNode } from "react";

export function PhoneShell({
  children,
  veil = "default",
}: {
  children: ReactNode;
  veil?: "default" | "strong" | "owner";
}) {
  const veilClass =
    veil === "owner"
      ? "velora-veil velora-veil-owner"
      : veil === "strong"
        ? "velora-veil velora-veil-strong"
        : "velora-veil";
  return (
    <div className="velora-stage">
      <div className="velora-phone">
        <div className={veilClass} />
        <div className="stars" />
        <div className="relative z-10 flex min-h-dvh flex-col">{children}</div>
      </div>
    </div>
  );
}

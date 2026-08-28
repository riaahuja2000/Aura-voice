/** Approximate synodic moon phase for decorative temple chrome. */
export type MoonKind = "new" | "waxing" | "full" | "waning";

export function moonKind(date = new Date()): MoonKind {
  const known = Date.UTC(2000, 0, 6, 18, 14);
  const synodic = 29.53058867;
  const days = (date.getTime() - known) / 86400000;
  const age = ((days % synodic) + synodic) % synodic;
  if (age < 1.8 || age > 27.7) return "new";
  if (age < 13.2) return "waxing";
  if (age < 16.4) return "full";
  return "waning";
}

export function moonGlyph(kind: MoonKind): string {
  if (kind === "new") return "●";
  if (kind === "waxing") return "☽";
  if (kind === "full") return "○";
  return "☾";
}

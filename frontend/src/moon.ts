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

export function moonIllumination(date = new Date()): number {
  const known = Date.UTC(2000, 0, 6, 18, 14);
  const synodic = 29.53058867;
  const days = (date.getTime() - known) / 86400000;
  const age = ((days % synodic) + synodic) % synodic;
  // 0 at new, 1 at full
  return (1 - Math.cos((age / synodic) * 2 * Math.PI)) / 2;
}

export function moonLabelKey(kind: MoonKind): "moon_new" | "moon_waxing" | "moon_full" | "moon_waning" {
  return `moon_${kind}` as any;
}

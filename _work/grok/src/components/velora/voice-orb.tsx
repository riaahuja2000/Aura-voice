import type { CSSProperties } from "react";
import { Mic } from "lucide-react";

export type VoicePhase = "idle" | "listening" | "processing" | "speaking" | "error";

const ORB: Record<VoicePhase, { bg: string; shadow: string }> = {
  idle: {
    bg: "radial-gradient(circle at 35% 30%, #f3e0a8 0%, #e8c36a 38%, #8a5a2b 100%)",
    shadow: "0 0 0 4px rgba(232,195,106,0.18), 0 10px 36px rgba(0,0,0,0.45)",
  },
  listening: {
    bg: "radial-gradient(circle at 35% 30%, #fff6d6 0%, #e8c36a 42%, #6b3f16 100%)",
    shadow: "0 0 0 8px rgba(232,195,106,0.28), 0 0 42px rgba(232,195,106,0.45)",
  },
  processing: {
    bg: "radial-gradient(circle at 35% 30%, #c9d4ff 0%, #8a7ad4 45%, #1a1233 100%)",
    shadow: "0 0 0 8px rgba(201,212,255,0.22), 0 0 40px rgba(201,212,255,0.35)",
  },
  speaking: {
    bg: "radial-gradient(circle at 35% 30%, #fff1c2 0%, #e8c36a 40%, #b8892d 100%)",
    shadow: "0 0 0 8px rgba(232,195,106,0.3), 0 0 48px rgba(232,195,106,0.5)",
  },
  error: {
    bg: "radial-gradient(circle at 35% 30%, #ffd0d0 0%, #b71c1c 100%)",
    shadow: "0 0 0 8px rgba(183,28,28,0.25), 0 0 32px rgba(183,28,28,0.4)",
  },
};

export function VoiceOrb({
  phase,
  onClick,
  label,
}: {
  phase: VoicePhase;
  onClick: () => void;
  label: string;
}) {
  const look = ORB[phase];
  const style: CSSProperties = {
    width: 96,
    height: 96,
    background: look.bg,
    boxShadow: look.shadow,
  };
  return (
    <button
      type="button"
      onClick={onClick}
      className="relative mt-2 flex select-none items-center justify-center rounded-full focus:outline-none active:scale-95"
      style={style}
      aria-label={label}
    >
      {(phase === "listening" || phase === "speaking") && (
        <>
          <span className="orb-ring" />
          <span className="orb-ring orb-ring-delay" />
        </>
      )}
      {phase === "processing" ? (
        <svg viewBox="0 0 48 48" className="lotus-spin h-9 w-9 text-gold-soft" aria-hidden>
          <path
            fill="currentColor"
            d="M24 6c2 6 2 10 0 16-2-6-2-10 0-16zm0 36c-2-6-2-10 0-16 2 6 2 10 0 16zM6 24c6-2 10-2 16 0-6 2-10 2-16 0zm36 0c-6 2-10 2-16 0 6-2 10-2 16 0zM12 12c6 2 9 5 12 12-7-3-10-6-12-12zm24 24c-6-2-9-5-12-12 7 3 10 6 12 12zM36 12c-6 2-9 5-12 12 7-3 10-6 12-12zM12 36c6-2 9-5 12-12-7 3-10 6-12 12z"
          />
        </svg>
      ) : (
        <Mic size={30} className="text-night" />
      )}
    </button>
  );
}

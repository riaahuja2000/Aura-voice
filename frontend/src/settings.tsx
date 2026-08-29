import React, { createContext, useCallback, useContext, useEffect, useState } from "react";
import { api, type Settings } from "@/src/api";

const DEFAULTS: Settings = {
  app_name: "AURA-VOICE",
  tagline: "Ask · Receive · Apply · Move",
  subtitle: "Occult sciences. Real life. Real results.",
  logo_url: "",
  background_url: "",
  voice: "shimmer",
  speed: 0.95,
};

type Ctx = {
  settings: Settings;
  refresh: () => Promise<void>;
  set: (s: Settings) => void;
};

const SettingsContext = createContext<Ctx>({ settings: DEFAULTS, refresh: async () => {}, set: () => {} });

export function SettingsProvider({ children }: { children: React.ReactNode }) {
  const [settings, setSettings] = useState<Settings>(DEFAULTS);

  const refresh = useCallback(async () => {
    try {
      const s = await api.getSettings();
      setSettings({ ...DEFAULTS, ...s });
    } catch {
      /* keep defaults */
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return (
    <SettingsContext.Provider value={{ settings, refresh, set: setSettings }}>
      {children}
    </SettingsContext.Provider>
  );
}

export function useSettings() {
  return useContext(SettingsContext);
}

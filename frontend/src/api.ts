import { storage } from "@/src/utils/storage";

const BASE = process.env.EXPO_PUBLIC_BACKEND_URL;
export const TOKEN_KEY = "velora_token";

export type Lang = "en" | "hi" | "hng";

export type User = {
  id: string;
  name: string;
  email: string;
  role: "owner" | "customer";
  language: Lang;
  voice?: string;
  speed?: number;
  active: boolean;
  is_owner: boolean;
  created_at?: string;
};

export type Reading = {
  id: string;
  question: string;
  answer: string;
  topics: string[];
  primary: string;
  lang: Lang;
  created_at: string;
};

export type Settings = {
  app_name: string;
  tagline: string;
  subtitle: string;
  logo_url: string;
  background_url: string;
  voice: string;
  speed: number;
};

async function getToken(): Promise<string | null> {
  return storage.secureGet<string>(TOKEN_KEY, "");
}

export function mediaUrl(pathOrUrl: string): string {
  if (!pathOrUrl) return "";
  if (pathOrUrl.startsWith("http")) return pathOrUrl;
  return `${BASE}${pathOrUrl}`;
}

async function req<T = any>(
  path: string,
  opts: { method?: string; body?: any; auth?: boolean } = {},
): Promise<T> {
  const { method = "GET", body, auth = true } = opts;
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (auth) {
    const token = await getToken();
    if (token) headers.Authorization = `Bearer ${token}`;
  }
  const res = await fetch(`${BASE}/api${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  let data: any = null;
  try {
    data = await res.json();
  } catch {
    /* ignore */
  }
  if (!res.ok) {
    const message = (data && (data.detail || data.message)) || "Something went wrong";
    throw new Error(typeof message === "string" ? message : "Something went wrong");
  }
  return data as T;
}

export const api = {
  // auth
  login: (email: string, password: string) =>
    req<{ token: string; user: User }>("/auth/login", { method: "POST", body: { email, password }, auth: false }),
  register: (name: string, email: string, password: string) =>
    req<{ token: string; user: User }>("/auth/register", { method: "POST", body: { name, email, password }, auth: false }),
  forgot: (email: string) =>
    req<{ ok: boolean; message: string }>("/auth/forgot-password", { method: "POST", body: { email }, auth: false }),
  me: () => req<User>("/auth/me"),
  updateProfile: (body: { name?: string; language?: Lang; voice?: string; speed?: number }) =>
    req<User>("/me", { method: "PATCH", body }),

  // oracle
  consult: (question: string, lang: Lang) =>
    req<Reading>("/oracle/consult", { method: "POST", body: { question, lang } }),
  daily: (lang: Lang) => req<{ date: string; text: string }>(`/oracle/daily?lang=${lang}`),
  readings: () => req<Reading[]>("/readings"),

  // owner knowledge
  knowledge: () => req<any>("/owner/knowledge"),
  addKnowledge: (topic: string, lang: Lang, text: string) =>
    req<any>("/owner/knowledge", { method: "POST", body: { topic, lang, text } }),
  deleteKnowledge: (id: string) => req<any>(`/owner/knowledge/${id}`, { method: "DELETE" }),
  async uploadKnowledge(uri: string, name: string, type: string): Promise<any> {
    const token = await getToken();
    const form = new FormData();
    if (typeof window !== "undefined" && (window as any).document) {
      const blob = await (await fetch(uri)).blob();
      form.append("file", blob, name);
    } else {
      // @ts-ignore native multipart shape
      form.append("file", { uri, name, type });
    }
    const res = await fetch(`${BASE}/api/owner/knowledge/upload`, {
      method: "POST",
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      body: form,
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error((data && data.detail) || "Upload failed");
    return data;
  },

  // settings
  getSettings: () => req<Settings>("/settings", { auth: false }),

  // owner
  ownerOverview: () => req<any>("/owner/overview"),
  updateSettings: (body: Partial<Settings>) => req<Settings>("/owner/settings", { method: "PUT", body }),
  setActive: (id: string, active: boolean) =>
    req<{ ok: boolean }>(`/owner/customers/${id}/active`, { method: "POST", body: { active } }),
  resetCustomer: (id: string, new_password: string) =>
    req<{ ok: boolean }>(`/owner/customers/${id}/reset`, { method: "POST", body: { new_password } }),

  async upload(kind: "logo" | "background", uri: string, name: string, type: string): Promise<{ url: string }> {
    const token = await getToken();
    const form = new FormData();
    form.append("kind", kind);
    // @ts-ignore — RN multipart shapes differ by runtime
    if (typeof window !== "undefined" && (window as any).document) {
      const blob = await (await fetch(uri)).blob();
      form.append("file", blob, name);
    } else {
      // @ts-ignore
      form.append("file", { uri, name, type });
    }
    const res = await fetch(`${BASE}/api/owner/upload`, {
      method: "POST",
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      body: form,
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error((data && data.detail) || "Upload failed");
    return data;
  },
};

export async function saveToken(token: string) {
  await storage.secureSet(TOKEN_KEY, token);
}
export async function clearToken() {
  await storage.secureRemove(TOKEN_KEY);
}

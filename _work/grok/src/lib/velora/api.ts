import { createServerFn } from "@tanstack/react-start";
import { authMiddleware } from "@/lib/auth/middleware";
import { getSql } from "@/lib/db";
import { OWNER_EMAIL, OWNER_NAME, OWNER_PASSWORD, isOwnerEmail, type Lang } from "./constants";
import { KNOWLEDGE_CORPUS, SYSTEM_PROMPT } from "./knowledge-corpus";
import { pickOpening } from "./openings";
import { detectTopics } from "./topics";
import oraclePack from "./oracle-pack.json";

type Pack = Record<string, Record<string, string[]>>;
const PACK = oraclePack as Pack;

export type ReadingRow = {
  id: number;
  user_id: string;
  question: string;
  answer: string;
  topics: string;
  lang: string;
  created_at: string;
};

function cannedAnswer(question: string, lang: Lang): { answer: string; topics: string[] } {
  const topics = detectTopics(question);
  const primary = topics[0] ?? "general";
  const pack = PACK[primary] ?? PACK.general;
  const list = pack?.[lang] ?? pack?.en ?? PACK.general.en;
  const body = list[Math.floor(Math.random() * list.length)] ?? list[0]!;
  return { answer: `${pickOpening(lang)}${body}`, topics };
}

function excerptsFor(topics: string[], lang: Lang): string {
  const chunks: string[] = [];
  for (const topic of topics.slice(0, 3)) {
    const pack = PACK[topic];
    if (!pack) continue;
    const list = pack[lang] ?? pack.en ?? [];
    if (list[0]) chunks.push(`[${topic}]\n${list.join("\n")}`);
  }
  return chunks.join("\n\n");
}

async function grokAnswer(question: string, lang: Lang, topics: string[]): Promise<string | null> {
  const apiKey = process.env.XAI_API_KEY;
  if (!apiKey) return null;
  const langLine =
    lang === "hi"
      ? "Respond entirely in Hindi Devanagari."
      : lang === "hng"
        ? "Respond in Hinglish (Hindi in Latin script mixed with English occult terms)."
        : "Respond in lucid English.";
  const user = `${langLine}

Seeker question: ${question}

Detected topics: ${topics.join(", ")}

Tradition excerpts:
${excerptsFor(topics, lang)}

Core corpus:
${KNOWLEDGE_CORPUS.slice(0, 7000)}
`;
  try {
    const res = await fetch("https://api.x.ai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "grok-4.5",
        temperature: 0.7,
        max_tokens: 420,
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: user },
        ],
      }),
    });
    if (!res.ok) return null;
    const body = (await res.json()) as {
      choices?: { message?: { content?: string } }[];
    };
    const text = body.choices?.[0]?.message?.content?.trim();
    if (!text) return null;
    return text.replace(/\s+/g, " ").trim();
  } catch {
    return null;
  }
}

export const ensureOwner = createServerFn({ method: "POST" }).handler(async () => {
  const sql = await getSql();
  const existing = await sql<{ id: string }>`
    select id from "user" where email = ${OWNER_EMAIL} limit 1
  `;
  if (existing.length) return { ok: true as const, seeded: false };
  const { auth } = await import("@/lib/auth/server");
  try {
    await auth.api.signUpEmail({
      body: {
        email: OWNER_EMAIL,
        password: OWNER_PASSWORD,
        name: OWNER_NAME,
      },
    });
    return { ok: true as const, seeded: true };
  } catch (err) {
    const again = await sql<{ id: string }>`
      select id from "user" where email = ${OWNER_EMAIL} limit 1
    `;
    if (again.length) return { ok: true as const, seeded: false };
    throw err;
  }
});

export const consultOracle = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: { question: string; lang: Lang }) => {
    const question = (input.question ?? "").trim().slice(0, 800);
    const lang: Lang = input.lang === "hi" || input.lang === "hng" ? input.lang : "en";
    if (!question) throw new Error("Empty question");
    return { question, lang };
  })
  .handler(async ({ context, data }) => {
    const topics = detectTopics(data.question);
    const generated = await grokAnswer(data.question, data.lang, topics);
    const fallback = cannedAnswer(data.question, data.lang);
    const answer = generated || fallback.answer;
    const sql = await getSql();
    const rows = await sql<{ id: number; created_at: string }>`
      insert into readings (user_id, question, answer, topics, lang)
      values (${context.userId}, ${data.question}, ${answer}, ${JSON.stringify(topics)}, ${data.lang})
      returning id, created_at
    `;
    const row = rows[0]!;
    return {
      id: row.id,
      question: data.question,
      answer,
      topics,
      lang: data.lang,
      created_at: row.created_at,
    };
  });

export const listMyReadings = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const sql = await getSql();
    const rows = await sql<ReadingRow>`
      select id, user_id, question, answer, topics, lang, created_at
      from readings
      where user_id = ${context.userId}
      order by created_at desc
      limit 50
    `;
    return rows.map((r) => ({
      ...r,
      topics: safeTopics(r.topics),
    }));
  });

function safeTopics(raw: string): string[] {
  try {
    const v = JSON.parse(raw);
    return Array.isArray(v) ? v.map(String) : [];
  } catch {
    return [];
  }
}

async function requireOwner(userId: string) {
  const sql = await getSql();
  const rows = await sql<{ email: string }>`
    select email from "user" where id = ${userId} limit 1
  `;
  const email = rows[0]?.email ?? "";
  if (!isOwnerEmail(email)) {
    const err = new Error("Forbidden");
    (err as Error & { status?: number }).status = 403;
    throw err;
  }
}

export const ownerOverview = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    await requireOwner(context.userId);
    const sql = await getSql();
    const readings = await sql<ReadingRow>`
      select id, user_id, question, answer, topics, lang, created_at
      from readings
      order by created_at desc
      limit 200
    `;
    const users = await sql<{
      id: string;
      name: string;
      email: string;
      createdAt: string;
    }>`
      select id, name, email, "createdAt" from "user" order by "createdAt" desc
    `;
    const mapped = readings.map((r) => ({ ...r, topics: safeTopics(r.topics) }));
    const topicCounts: Record<string, number> = {};
    for (const r of mapped) {
      for (const t of r.topics) topicCounts[t] = (topicCounts[t] ?? 0) + 1;
    }
    const mostAsked = Object.entries(topicCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([name, count]) => ({ name, count }));
    const last7 = Array.from({ length: 7 }, (_, i) => {
      const d = new Date();
      d.setDate(d.getDate() - (6 - i));
      const key = d.toDateString();
      const count = mapped.filter((r) => new Date(r.created_at).toDateString() === key).length;
      return {
        label: d.toLocaleDateString("en-US", { weekday: "short" }),
        count,
      };
    });
    const todayKey = new Date().toDateString();
    return {
      totalSessions: mapped.length,
      registeredUsers: users.length,
      today: mapped.filter((r) => new Date(r.created_at).toDateString() === todayKey).length,
      topicsCovered: Object.keys(topicCounts).length,
      mostAsked,
      last7,
      recent: mapped.slice(0, 12),
      members: users.map((u) => ({
        id: u.id,
        name: u.name,
        email: u.email,
        createdAt: u.createdAt,
        isOwner: isOwnerEmail(u.email),
      })),
    };
  });

export const getMeProfile = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const sql = await getSql();
    const rows = await sql<{
      id: string;
      name: string;
      email: string;
      createdAt: string;
    }>`
      select id, name, email, "createdAt" from "user" where id = ${context.userId} limit 1
    `;
    const u = rows[0];
    if (!u) return { id: context.userId, name: "", email: "", createdAt: "", isOwner: false, readings: 0 };
    const count = await sql<{ n: number }>`
      select count(*)::int as n from readings where user_id = ${context.userId}
    `;
    return {
      id: u.id,
      name: u.name,
      email: u.email,
      createdAt: u.createdAt,
      isOwner: isOwnerEmail(u.email),
      readings: count[0]?.n ?? 0,
    };
  });

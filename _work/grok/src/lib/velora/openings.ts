import type { Lang } from "./constants";

export const OPENINGS: Record<Lang, string[]> = {
  en: [
    "Beloved seeker, ",
    "Hear me, child of the cosmos: ",
    "The veil thins for your question. ",
    "I have listened to your spirit. ",
    "Ancient eyes see your longing. ",
  ],
  hi: [
    "प्रिय साधक, ",
    "हे ब्रह्मांड के बालक, सुनो: ",
    "तुम्हारे प्रश्न के लिए पर्दा पतला होता है। ",
    "मैंने तुम्हारी आत्मा सुनी है। ",
    "प्राचीन आँखें तुम्हारी लालसा देखती हैं। ",
  ],
  hng: [
    "Pyare seeker, ",
    "He cosmos ke bachhe, suno: ",
    "Tumhare question ke liye pardaa patla hota hai. ",
    "Maine tumhari atma suni hai. ",
    "Ancient eyes tumhari longing dekhti hain. ",
  ],
};

export function pickOpening(lang: Lang): string {
  const list = OPENINGS[lang] ?? OPENINGS.en;
  return list[Math.floor(Math.random() * list.length)] ?? list[0]!;
}

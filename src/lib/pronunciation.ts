import "server-only";

import { getSupabaseAdmin } from "@/lib/supabase-admin";
import type { Word } from "@/lib/types";

/**
 * Recorded pronunciations: Google Cloud Text-to-Speech reads each word in its
 * own language with one consistent woman's voice, the MP3 goes to the public
 * `pronunciations` bucket, and its URL to words.audio_url (which the app
 * plays instead of on-device speech). Runs when a word is saved, so new words
 * get a recording with no extra step.
 */

const BUCKET = "pronunciations";
const TTS = "https://texttospeech.googleapis.com/v1";
const FALLBACK_LOCALE = "en-US";

/** Default voice locale for a word's language. Unknown languages read in English. */
const LANGUAGE_LOCALES: Record<string, string> = {
  english: "en-US",
  "english (modern coinage)": "en-US",
  "english (archaic)": "en-US",
  "english (rare)": "en-US",
  german: "de-DE",
  french: "fr-FR",
  dutch: "nl-NL",
  spanish: "es-ES",
  "latin american spanish": "es-US",
  italian: "it-IT",
  danish: "da-DK",
  turkish: "tr-TR",
  "brazilian portuguese": "pt-BR",
  portuguese: "pt-PT",
  norwegian: "nb-NO",
  swedish: "sv-SE",
  finnish: "fi-FI",
  indonesian: "id-ID",
  tagalog: "fil-PH",
  // No Welsh or Irish voice exists yet; British English is the closest accent.
  welsh: "en-GB",
  irish: "en-GB",
  lithuanian: "lt-LT",
  serbian: "sr-RS",
  greek: "el-GR",
  japanese: "ja-JP",
  arabic: "ar-XA",
  "arabic / urdu": "ur-IN",
  hebrew: "he-IL",
  "hindi / sanskrit": "hi-IN",
  sanskrit: "hi-IN",
  "sanskrit (modern coinage)": "hi-IN",
  russian: "ru-RU",
  "old norse": "is-IS",
};

export function defaultVoiceLocale(language: string) {
  return LANGUAGE_LOCALES[language.trim().toLowerCase()] ?? FALLBACK_LOCALE;
}

/** The text and voice a word is read with. */
export function speechFor(word: Pick<Word, "word" | "language" | "native_spelling" | "voice_locale">) {
  return {
    text: (word.native_spelling?.trim() || word.word).trim(),
    locale: word.voice_locale?.trim() || defaultVoiceLocale(word.language),
  };
}

export function pronunciationEnabled() {
  return Boolean(process.env.GOOGLE_TTS_API_KEY);
}

function apiKey() {
  const key = process.env.GOOGLE_TTS_API_KEY;
  if (!key) throw new Error("Recordings are off: GOOGLE_TTS_API_KEY is not set.");
  return key;
}

type GoogleVoice = { name: string; languageCodes: string[]; ssmlGender: string };

/** Preferred voices, best first. One named voice keeps every word sounding alike. */
const PREFERRED_CHIRP_VOICE = "Kore";
const TIERS = ["Chirp3-HD", "Chirp-HD", "Neural2", "Wavenet", "Standard"];

const voiceCache = new Map<string, GoogleVoice | null>();

async function voiceFor(locale: string): Promise<GoogleVoice | null> {
  if (voiceCache.has(locale)) return voiceCache.get(locale) ?? null;
  const response = await fetch(`${TTS}/voices?languageCode=${encodeURIComponent(locale)}`, {
    headers: { "X-Goog-Api-Key": apiKey() },
  });
  if (!response.ok) throw new Error(`Google voices request failed (${response.status}).`);
  const { voices = [] } = (await response.json()) as { voices?: GoogleVoice[] };
  const female = voices.filter(
    (voice) => voice.ssmlGender === "FEMALE" && voice.languageCodes.includes(locale),
  );
  let chosen: GoogleVoice | null = null;
  for (const tier of TIERS) {
    const inTier = female.filter((voice) => voice.name.includes(`-${tier}-`));
    if (inTier.length > 0) {
      chosen = inTier.find((voice) => voice.name.endsWith(`-${PREFERRED_CHIRP_VOICE}`)) ?? inTier[0];
      break;
    }
  }
  voiceCache.set(locale, chosen);
  return chosen;
}

/** Synthesizes the word; falls back to English when a language has no voice. */
async function synthesize(text: string, locale: string) {
  let voiceLocale = locale;
  let voice = await voiceFor(locale);
  if (!voice && locale !== FALLBACK_LOCALE) {
    voiceLocale = FALLBACK_LOCALE;
    voice = await voiceFor(FALLBACK_LOCALE);
  }
  if (!voice) throw new Error(`No voice available for ${locale}.`);

  const response = await fetch(`${TTS}/text:synthesize`, {
    method: "POST",
    headers: { "X-Goog-Api-Key": apiKey(), "Content-Type": "application/json" },
    body: JSON.stringify({
      input: { text },
      voice: { languageCode: voiceLocale, name: voice.name },
      audioConfig: { audioEncoding: "MP3" },
    }),
  });
  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(`Google speech request failed (${response.status}). ${detail.slice(0, 200)}`);
  }
  const { audioContent } = (await response.json()) as { audioContent?: string };
  if (!audioContent) throw new Error("Google returned no audio.");
  return { audio: Buffer.from(audioContent, "base64"), voice: voice.name };
}

/** True when audio_url points at a recording this panel generated. */
export function isGeneratedAudio(url: string | null) {
  return Boolean(url && url.includes(`/storage/v1/object/public/${BUCKET}/`));
}

/**
 * Records the word, uploads it and saves its URL. A hand-entered audio URL
 * (not generated here) is left alone unless `force` is set.
 */
export async function generatePronunciation(
  word: Pick<Word, "id" | "slug" | "word" | "language" | "native_spelling" | "voice_locale" | "audio_url">,
  { force = false }: { force?: boolean } = {},
) {
  if (word.audio_url && !isGeneratedAudio(word.audio_url) && !force) {
    return { skipped: true as const, url: word.audio_url };
  }
  const { text, locale } = speechFor(word);
  const { audio, voice } = await synthesize(text, locale);

  const supabase = getSupabaseAdmin();
  const path = `${word.slug}.mp3`;
  const { error: uploadError } = await supabase.storage
    .from(BUCKET)
    .upload(path, audio, { contentType: "audio/mpeg", upsert: true, cacheControl: "31536000" });
  if (uploadError) throw new Error(uploadError.message);

  // Version the URL so the app (and its cache) fetch the new file.
  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
  const url = `${data.publicUrl}?v=${Date.now()}`;
  const { error: updateError } = await supabase.from("words").update({ audio_url: url }).eq("id", word.id);
  if (updateError) throw new Error(updateError.message);

  return { skipped: false as const, url, voice };
}

/** Whether a save changed anything the recording depends on. */
export function needsNewRecording(
  before: Pick<Word, "word" | "language" | "native_spelling" | "voice_locale" | "audio_url"> | null,
  after: Pick<Word, "word" | "language" | "native_spelling" | "voice_locale" | "audio_url">,
) {
  if (!after.audio_url) return true;
  if (!isGeneratedAudio(after.audio_url)) return false;
  if (!before) return true;
  const a = speechFor(before);
  const b = speechFor(after);
  return a.text !== b.text || a.locale !== b.locale;
}

import "server-only";

/**
 * For a new word, decide how the recording should sound without anyone
 * typing it: which native voice to use, and (for non-Latin scripts) the word
 * in its own script for that voice to read. Uses Gemini (GEMINI_API_KEY);
 * without it, new words use their language's default voice. Never shown in
 * the app; the visible spelling is untouched.
 */

/** Voices recordings may use. Anything else falls back to the language default. */
export const ALLOWED_VOICE_LOCALES = [
  "en-US", "en-GB", "ar-XA", "da-DK", "de-DE", "el-GR", "es-ES", "es-US",
  "fi-FI", "fil-PH", "fr-FR", "he-IL", "hi-IN", "id-ID", "is-IS", "it-IT", "ja-JP",
  "ko-KR", "lt-LT", "nb-NO", "nl-NL", "pl-PL", "pt-BR", "pt-PT", "ru-RU", "sr-RS",
  "sv-SE", "th-TH", "tr-TR", "uk-UA", "ur-IN", "vi-VN", "cmn-CN",
] as const;

/** Voices that need the word in their own (non-Latin) script. */
const NON_LATIN = new Set(["ar-XA", "el-GR", "he-IL", "hi-IN", "ja-JP", "ko-KR", "ru-RU", "th-TH", "uk-UA", "ur-IN", "cmn-CN"]);

const MODEL = "gemini-2.5-flash";

export type VoiceGuess = { voice_locale: string; native_spelling: string | null };

export async function guessVoice(word: {
  word: string;
  language: string;
  pronunciation: string;
}): Promise<VoiceGuess | null> {
  // A Gemini key from Google AI Studio (Cloud console keys can't use Gemini).
  const key = process.env.GEMINI_API_KEY;
  if (!key) return null;

  const prompt = [
    "You choose the voice for a recorded pronunciation in a dictionary of emotion words.",
    `Word: ${word.word}`,
    `Language of origin: ${word.language}`,
    `English pronunciation guide: ${word.pronunciation}`,
    "",
    "Pick voice_locale: the voice a native speaker would use to say this word as it is commonly said.",
    "If English speakers use the word as an English word (e.g. catharsis, nostalgia), choose en-US.",
    "If the language has no voice in the list, choose the closest voice whose sounds read the word correctly, or en-US.",
    `Allowed values: ${ALLOWED_VOICE_LOCALES.join(", ")}.`,
    "Pick native_spelling: the word written in that voice's own script, only when that script is not the Latin alphabet",
    "(e.g. тоска for ru-RU, 木漏れ日 for ja-JP, μεράκι for el-GR). Otherwise null.",
  ].join("\n");

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`,
    {
      method: "POST",
      headers: { "x-goog-api-key": key, "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0,
          responseMimeType: "application/json",
          responseSchema: {
            type: "OBJECT",
            properties: {
              voice_locale: { type: "STRING", enum: [...ALLOWED_VOICE_LOCALES] },
              native_spelling: { type: "STRING", nullable: true },
            },
            required: ["voice_locale"],
          },
        },
      }),
      signal: AbortSignal.timeout(20_000),
    },
  );
  if (!response.ok) throw new Error(`Voice suggestion failed (${response.status}).`);

  const body = (await response.json()) as {
    candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
  };
  const text = body.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) return null;
  const parsed = JSON.parse(text) as { voice_locale?: string; native_spelling?: string | null };

  const locale = parsed.voice_locale ?? "";
  if (!(ALLOWED_VOICE_LOCALES as readonly string[]).includes(locale)) return null;
  const spelling = parsed.native_spelling?.trim() || null;
  return {
    voice_locale: locale,
    // Only keep a script spelling for voices that need one, and keep it short.
    native_spelling: NON_LATIN.has(locale) && spelling && spelling.length <= 120 ? spelling : null,
  };
}

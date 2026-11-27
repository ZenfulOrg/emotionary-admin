import "server-only";

import {
  generatePronunciation,
  needsTrim,
  pronunciationEnabled,
  trimRecording,
} from "@/lib/pronunciation";
import { listWords, setWordVoice } from "@/lib/supabase-admin";
import { guessVoice } from "@/lib/voice-guess";

export type RecordMissingResult = {
  recorded: string[];
  tightened: number;
  failed: string[];
  enabled: boolean;
};

/**
 * Records every word that has no audio yet, however it was added (this panel,
 * a bulk import, or SQL), and cuts the pause before older recordings. A word
 * with no voice chosen gets its native voice and script first, exactly like
 * saving it here. Safe to run repeatedly: words with audio are skipped.
 */
export async function recordMissingPronunciations(): Promise<RecordMissingResult> {
  const enabled = pronunciationEnabled();
  const words = await listWords();
  const missing = enabled ? words.filter((word) => !word.audio_url) : [];
  const untrimmed = words.filter((word) => needsTrim(word.audio_url));
  const recorded: string[] = [];
  const failed: string[] = [];

  for (let word of missing) {
    try {
      if (!word.voice_locale && !word.native_spelling) {
        try {
          const guess = await guessVoice(word);
          if (guess) word = await setWordVoice(word.id, guess);
        } catch {
          // Fall back to the language's default voice.
        }
      }
      await generatePronunciation(word);
      recorded.push(word.word);
    } catch {
      failed.push(word.word);
    }
  }

  // A few at a time: each is a small download and upload.
  for (let i = 0; i < untrimmed.length; i += 8) {
    await Promise.all(
      untrimmed.slice(i, i + 8).map(async (word) => {
        try {
          await trimRecording(word);
        } catch {
          failed.push(word.word);
        }
      }),
    );
  }

  return { recorded, tightened: untrimmed.length, failed, enabled };
}

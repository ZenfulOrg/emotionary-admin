"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import {
  assertAdminSession,
  clearAdminSession,
  createAdminSession,
  verifyAdminPassword,
} from "@/lib/auth";
import {
  generatePronunciation,
  needsNewRecording,
  pronunciationEnabled,
} from "@/lib/pronunciation";
import {
  findWordById,
  listWords,
  setWordPublished,
  setWordVoice,
  upsertWord,
} from "@/lib/supabase-admin";
import { guessVoice } from "@/lib/voice-guess";
import type { ActionState } from "@/lib/types";
import { formDataToWordInput, toWordFormInput } from "@/lib/word-schema";

const defaultState: ActionState = {
  ok: false,
  message: "",
};

function formatError(error: unknown): ActionState {
  if (error instanceof z.ZodError) {
    return {
      ok: false,
      message: "Check the highlighted fields.",
      // Story issues arrive as ["story", "roots"]; the form names them story_roots.
      fieldErrors: error.issues.reduce<Record<string, string[]>>((errors, issue) => {
        const key = issue.path[0] === "story" && issue.path[1]
          ? `story_${String(issue.path[1])}`
          : String(issue.path[0] ?? "form");
        (errors[key] ??= []).push(issue.message);
        return errors;
      }, {}),
    };
  }

  if (error instanceof Error) {
    return {
      ok: false,
      message: error.message,
    };
  }

  return {
    ok: false,
    message: "Something went wrong.",
  };
}

export async function loginAction(
  previousState: ActionState = defaultState,
  formData: FormData,
): Promise<ActionState> {
  void previousState;

  try {
    const password = String(formData.get("password") ?? "");

    if (!verifyAdminPassword(password)) {
      return {
        ok: false,
        message: "Password is incorrect.",
      };
    }

    await createAdminSession();
  } catch (error) {
    return formatError(error);
  }

  redirect("/");
}

export async function logoutAction() {
  await clearAdminSession();
  redirect("/login");
}

export async function saveWordAction(
  previousState: ActionState = defaultState,
  formData: FormData,
): Promise<ActionState> {
  void previousState;

  try {
    await assertAdminSession();
    const input = toWordFormInput(formDataToWordInput(formData));
    const previous = input.id ? await findWordById(input.id) : null;
    let word = await upsertWord(input);

    // New word (or new spelling/language) with no voice chosen: let Gemini
    // pick the native voice and script, so nobody has to type them.
    const changed =
      !previous || previous.word !== word.word || previous.language !== word.language;
    if (pronunciationEnabled() && changed && !word.voice_locale && !word.native_spelling) {
      try {
        const guess = await guessVoice(word);
        if (guess) word = await setWordVoice(word.id, guess);
      } catch {
        // Fall back to the language's default voice.
      }
    }

    // New or changed words get a fresh recording automatically. A failed
    // recording never blocks the save; the app falls back to device speech.
    let recordingNote = "";
    if (pronunciationEnabled() && needsNewRecording(previous, word)) {
      try {
        await generatePronunciation(word);
        recordingNote = " Recording updated.";
      } catch (error) {
        recordingNote = ` Recording failed: ${error instanceof Error ? error.message : "unknown error"}`;
      }
    }

    revalidatePath("/");

    return {
      ok: true,
      message:
        (input.published
          ? `${word.word} is published.`
          : `${word.word} is saved as a draft.`) + recordingNote,
    };
  } catch (error) {
    return formatError(error);
  }
}

export async function togglePublishedAction(
  formData: FormData,
): Promise<ActionState> {
  try {
    await assertAdminSession();
    const id = z.string().uuid().parse(String(formData.get("id") ?? ""));
    const published = String(formData.get("published") ?? "") === "true";
    const word = await setWordPublished(id, published);

    revalidatePath("/");

    return {
      ok: true,
      message: published
        ? `${word.word} is published.`
        : `${word.word} is unpublished.`,
    };
  } catch (error) {
    return formatError(error);
  }
}

/** Re-records one word (e.g. it sounded off), replacing any generated file. */
export async function regeneratePronunciationAction(
  formData: FormData,
): Promise<ActionState> {
  try {
    await assertAdminSession();
    const id = z.string().uuid().parse(String(formData.get("id") ?? ""));
    const word = await findWordById(id);
    const result = await generatePronunciation(word, { force: true });

    revalidatePath("/");

    return {
      ok: true,
      message: result.skipped
        ? `${word.word} keeps its custom audio.`
        : `${word.word} has a new recording.`,
    };
  } catch (error) {
    return formatError(error);
  }
}

/** Records every word that has no audio yet. Safe to run repeatedly. */
export async function recordMissingPronunciationsAction(): Promise<ActionState> {
  try {
    await assertAdminSession();
    if (!pronunciationEnabled()) {
      return { ok: false, message: "Recordings are off: GOOGLE_TTS_API_KEY is not set." };
    }
    const missing = (await listWords()).filter((word) => !word.audio_url);
    const failed: string[] = [];
    for (const word of missing) {
      try {
        await generatePronunciation(word);
      } catch {
        failed.push(word.word);
      }
    }

    revalidatePath("/");

    const done = missing.length - failed.length;
    return {
      ok: failed.length === 0,
      message:
        missing.length === 0
          ? "Every word already has a recording."
          : `Recorded ${done} of ${missing.length} words.` +
            (failed.length ? ` Failed: ${failed.join(", ")}.` : ""),
    };
  } catch (error) {
    return formatError(error);
  }
}

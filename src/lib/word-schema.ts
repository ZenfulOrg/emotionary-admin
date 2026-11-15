import { z } from "zod";

import { WORD_TYPES } from "@/lib/types";

const optionalUrl = z
  .string()
  .trim()
  .optional()
  .transform((value) => (value ? value : null))
  .pipe(z.string().url("Enter a valid URL.").nullable());

export const wordFormSchema = z.object({
  id: z.string().uuid().optional(),
  slug: z
    .string()
    .trim()
    .min(2, "Slug needs at least 2 characters.")
    .max(96, "Slug is too long.")
    .regex(
      /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
      "Use lowercase letters, numbers, and hyphens only.",
    ),
  word: z.string().trim().min(1, "Word is required.").max(120),
  pronunciation: z
    .string()
    .trim()
    .min(1, "Pronunciation is required.")
    .max(160),
  language: z.string().trim().min(1, "Language is required.").max(80),
  type: z.enum(WORD_TYPES),
  level: z.coerce.number().int().min(1).max(5),
  definition: z.string().trim().min(1, "Definition is required.").max(2000),
  wisdom: z.string().trim().min(1, "Wisdom is required.").max(2000),
  is_free: z.coerce.boolean(),
  free_order: z
    .string()
    .trim()
    .optional()
    .transform((value) => (value ? Number(value) : null))
    .pipe(
      z
        .number()
        .int("Use a whole number.")
        .min(1, "Use 1 or higher.")
        .max(999, "Use 999 or lower.")
        .nullable(),
    ),
  published: z.coerce.boolean(),
  audio_url: optionalUrl,
  native_spelling: z
    .string()
    .trim()
    .max(120, "Native spelling is too long.")
    .optional()
    .transform((value) => (value ? value : null)),
  voice_locale: z
    .string()
    .trim()
    .optional()
    .transform((value) => (value ? value : null))
    .pipe(
      z
        .string()
        .regex(/^[a-z]{2,3}(-[A-Za-z0-9]{2,4})?$/, "Use a voice code like ja-JP.")
        .nullable(),
    ),
});

export function slugify(value: string) {
  return value
    .trim()
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-");
}

export function formDataToWordInput(formData: FormData) {
  const intent = String(formData.get("intent") ?? "draft");
  const word = String(formData.get("word") ?? "");
  const requestedSlug = String(formData.get("slug") ?? "");
  const slug = slugify(requestedSlug || word);
  const id = String(formData.get("id") ?? "");

  return wordFormSchema.parse({
    id: id || undefined,
    slug,
    word,
    pronunciation: String(formData.get("pronunciation") ?? ""),
    language: String(formData.get("language") ?? ""),
    type: String(formData.get("type") ?? ""),
    level: String(formData.get("level") ?? "1"),
    definition: String(formData.get("definition") ?? ""),
    wisdom: String(formData.get("wisdom") ?? ""),
    is_free: formData.get("is_free") === "on",
    free_order: String(formData.get("free_order") ?? ""),
    published: intent === "publish",
    audio_url: String(formData.get("audio_url") ?? ""),
    native_spelling: String(formData.get("native_spelling") ?? ""),
    voice_locale: String(formData.get("voice_locale") ?? ""),
  });
}

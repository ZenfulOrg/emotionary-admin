export const WORD_TYPES = [
  "wanderword",
  "hidden_english",
  "psychology",
] as const;

export type WordType = (typeof WORD_TYPES)[number];

/** Back of the word card in the app: shown to Pro users once live. */
export type WordStory = {
  background: string;
  roots: { part: string; meaning: string }[];
  myth: string | null;
  fun_fact: string | null;
};

export type StoryStatus = "draft" | "live";

export type Word = {
  id: string;
  slug: string;
  word: string;
  pronunciation: string;
  language: string;
  type: WordType;
  level: number;
  definition: string;
  wisdom: string;
  is_free: boolean;
  free_order: number | null;
  published: boolean;
  published_at: string | null;
  audio_url: string | null;
  native_spelling: string | null;
  voice_locale: string | null;
  story: WordStory | null;
  story_status: StoryStatus;
  created_at: string;
  updated_at: string;
};

export type WordFormInput = {
  id?: string;
  slug: string;
  word: string;
  pronunciation: string;
  language: string;
  type: WordType;
  level: number;
  definition: string;
  wisdom: string;
  is_free: boolean;
  free_order: number | null;
  published: boolean;
  audio_url: string | null;
  native_spelling: string | null;
  voice_locale: string | null;
  story: WordStory | null;
  story_status: StoryStatus;
};

export type ActionState = {
  ok: boolean;
  message: string;
  fieldErrors?: Record<string, string[] | undefined>;
};

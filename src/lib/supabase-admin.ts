import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import type { Word, WordFormInput } from "@/lib/types";

const DEFAULT_SUPABASE_URL = "https://zqrdwqvkofhxfxkondmx.supabase.co";

type WordInsert = Omit<Word, "id" | "created_at"> & {
  id?: string;
  created_at?: string;
};

let adminClient: SupabaseClient | null = null;

function requireEnv(name: string, fallback?: string) {
  const value = process.env[name] || fallback;

  if (!value) {
    throw new Error(`Missing ${name}.`);
  }

  return value;
}

export function getSupabaseConfigStatus() {
  return {
    hasUrl: Boolean(process.env.SUPABASE_URL || DEFAULT_SUPABASE_URL),
    hasServiceRoleKey: Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY),
  };
}

export function getSupabaseAdmin() {
  if (adminClient) {
    return adminClient;
  }

  const url = requireEnv(
    "SUPABASE_URL",
    process.env.NEXT_PUBLIC_SUPABASE_URL || DEFAULT_SUPABASE_URL,
  );
  const serviceRoleKey = requireEnv("SUPABASE_SERVICE_ROLE_KEY");

  adminClient = createClient(url, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  return adminClient;
}

export async function listWords() {
  const { data, error } = await getSupabaseAdmin()
    .from("words")
    .select("*")
    .order("updated_at", { ascending: false })
    .limit(1000);

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []) as Word[];
}

export async function findWordById(id: string) {
  const { data, error } = await getSupabaseAdmin()
    .from("words")
    .select("*")
    .eq("id", id)
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return data as Word;
}

export async function upsertWord(input: WordFormInput) {
  const now = new Date().toISOString();
  const existing = input.id ? await findWordById(input.id) : null;
  const publishedAt = input.published
    ? existing?.published_at ?? now
    : null;

  const payload: Partial<WordInsert> = {
    slug: input.slug,
    word: input.word,
    pronunciation: input.pronunciation,
    language: input.language,
    type: input.type,
    level: input.level,
    definition: input.definition,
    wisdom: input.wisdom,
    is_free: input.is_free,
    published: input.published,
    published_at: publishedAt,
    audio_url: input.audio_url,
    updated_at: now,
  };

  const query = input.id
    ? getSupabaseAdmin()
        .from("words")
        .update(payload)
        .eq("id", input.id)
        .select("*")
        .single()
    : getSupabaseAdmin()
        .from("words")
        .insert(payload)
        .select("*")
        .single();

  const { data, error } = await query;

  if (error) {
    throw new Error(error.message);
  }

  return data as Word;
}

export async function setWordPublished(id: string, published: boolean) {
  const existing = await findWordById(id);
  const { data, error } = await getSupabaseAdmin()
    .from("words")
    .update({
      published,
      published_at: published
        ? existing.published_at ?? new Date().toISOString()
        : null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .select("*")
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return data as Word;
}

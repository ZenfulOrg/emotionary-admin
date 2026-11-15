#!/usr/bin/env node
/**
 * Listen before recording everything: synthesizes a few sample words with the
 * same voice choice the admin panel uses and writes MP3s to a local folder.
 * Touches nothing in Supabase.
 *
 * Usage: GOOGLE_TTS_API_KEY in .env.local, then
 *   node scripts/pronunciation-samples.mjs [output-folder]
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const env = Object.fromEntries(
  readFileSync(new URL("../.env.local", import.meta.url), "utf8")
    .split("\n")
    .map((line) => line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/))
    .filter(Boolean)
    .map(([, key, value]) => [key, value.replace(/^["']|["']$/g, "")]),
);
const key = process.env.GOOGLE_TTS_API_KEY || env.GOOGLE_TTS_API_KEY;
if (!key) {
  console.error("Add GOOGLE_TTS_API_KEY to emotionary-admin/.env.local first.");
  process.exit(1);
}

const SAMPLES = [
  { slug: "toska", text: "тоска", locale: "ru-RU" },
  { slug: "saudade", text: "saudade", locale: "pt-PT" },
  { slug: "koi-no-yokan", text: "恋の予感", locale: "ja-JP" },
  { slug: "meraki", text: "μεράκι", locale: "el-GR" },
  { slug: "hygge", text: "hygge", locale: "da-DK" },
  { slug: "catharsis", text: "catharsis", locale: "en-US" },
];

const TTS = "https://texttospeech.googleapis.com/v1";
const TIERS = ["Chirp3-HD", "Chirp-HD", "Neural2", "Wavenet", "Standard"];
const headers = { "X-Goog-Api-Key": key, "Content-Type": "application/json" };

async function voiceFor(locale) {
  const response = await fetch(`${TTS}/voices?languageCode=${locale}`, { headers });
  if (!response.ok) throw new Error(`voices ${locale}: ${response.status} ${await response.text()}`);
  const { voices = [] } = await response.json();
  const female = voices.filter((v) => v.ssmlGender === "FEMALE" && v.languageCodes.includes(locale));
  for (const tier of TIERS) {
    const inTier = female.filter((v) => v.name.includes(`-${tier}-`));
    if (inTier.length) return inTier.find((v) => v.name.endsWith("-Kore")) ?? inTier[0];
  }
  return null;
}

const out = process.argv[2] || join(process.cwd(), "pronunciation-samples");
mkdirSync(out, { recursive: true });

for (const sample of SAMPLES) {
  const voice = await voiceFor(sample.locale);
  if (!voice) {
    console.log(`✗ ${sample.slug}: no ${sample.locale} voice`);
    continue;
  }
  const response = await fetch(`${TTS}/text:synthesize`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      input: { text: sample.text },
      voice: { languageCode: sample.locale, name: voice.name },
      audioConfig: { audioEncoding: "MP3" },
    }),
  });
  if (!response.ok) {
    console.log(`✗ ${sample.slug}: ${response.status} ${(await response.text()).slice(0, 160)}`);
    continue;
  }
  const { audioContent } = await response.json();
  const file = join(out, `${sample.slug}.mp3`);
  writeFileSync(file, Buffer.from(audioContent, "base64"));
  console.log(`✓ ${sample.slug} (${sample.text}) → ${voice.name}`);
}
console.log(`Samples in ${out}`);

<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Adding words (read before adding or importing words)

- Prefer adding words through this admin panel: saving a word picks its native voice and script and records its pronunciation right away.
- Bulk imports or SQL inserts are fine, but they skip that step. An hourly job (`/api/cron/record-pronunciations`, see vercel.json) records any word without audio in its native voice. To record immediately, use "Record missing" in the panel.
- For a non-English word, set `voice_locale` and, for non-Latin scripts (Greek, Arabic, Hindi/Sanskrit, Japanese, Chinese, Korean, Hebrew, Russian), `native_spelling` in that script. Follow the existing words (for example Agape: el-GR, αγάπη). Without GEMINI_API_KEY in Vercel, nothing guesses these, and the language's default voice reads the Latin spelling.
- After adding words, check: `select word, language from words where audio_url is null;` should come back empty within the hour.

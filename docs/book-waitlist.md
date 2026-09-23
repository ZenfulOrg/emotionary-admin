# Book waitlist

## Current state

The live Supabase project is **Emotionary**, `zqrdwqvkofhxfxkondmx`. On September 23, 2026, the two reviewed local schema files were applied together as the remote migration `book_waitlist_and_signup`. Do not blindly push these two filenames as new remote migrations; reconcile the remote history first.

The admin provides `/waitlist`, authenticated `/api/waitlist/export`, and public POST `/api/waitlist/signup`. The public website at `https://emotionary-website.vercel.app` sends signup requests to `https://emotionary-admin.vercel.app/api/waitlist/signup`. Production credentials remain in the existing admin's Vercel environment; the website contains no Supabase credentials.

## Team workflow

- Sign in through the existing admin login and choose **Book waitlist**.
- Browse email address, original signup date/time (UTC), signup source, and subscription status.
- Filter by email, inclusive UTC date range, or status. Active signups are the default.
- **Copy all matching emails** copies every result, not only the current page. If clipboard permission is denied, a selectable text box appears.
- **Export CSV** downloads the entire filtered result with signup timestamps, source, status, and consent version. Spreadsheet formula prefixes are escaped.
- An unavailable database is shown as a connection error, not an empty successful list.

These are book-launch subscribers, not Supabase Auth accounts or all mobile-app users. `active` records have expressed interest; the address is not represented as confirmed or verified.

## Database design and access

Schema files: `supabase/migrations/20260923185742_book_waitlist.sql` and `supabase/migrations/20260923191049_book_waitlist_signup.sql`.

`public.book_waitlist` stores a unique normalized email, database-generated signup timestamp, source, active/unsubscribed status, consent version, and unsubscribe timestamp. Its indexes support signup-date/status queries. Anonymous and ordinary authenticated clients have no table privileges or RLS policies. Only the existing server-side service role has select, insert, and update privileges. Delete permission is not granted.

The Next.js page and export route both verify the existing signed admin session before loading private data. The data-access layer also checks the session. No service key or subscriber list is exposed on the public website. Exports use private/no-store responses. Export reads use ID-based batches and an upper ID bound, so the database response cap and new arrivals do not truncate or shift the export.

## Public signup and deployment

- POST JSON to the signup endpoint: `email`, `company` (empty honeypot), and `consent: "book-launch-2026-09-23"`.
- Only the production website and `emotionarybook.com` / `www.emotionarybook.com` origins are accepted. Additional exact origins can be configured with comma-separated `WAITLIST_ALLOWED_ORIGINS` on the admin.
- Requests require JSON, are limited to 2 KB, and validate and normalize email server-side. CORS never grants cookie access.
- Vercel's trusted client IP header is HMAC-hashed with the existing admin session secret. Raw IPs are not stored. Shared database limits allow 10 attempts per IP per 15-minute window and 1,000 total per hour. Expired counters are removed on subsequent requests.
- The RPC runs with caller privileges and is executable only by the service role. Atomic counters prevent concurrent requests bypassing limits. Duplicates use `ON CONFLICT DO NOTHING`, preserving the original signup date and any unsubscribe.
- The public response is the same for new and duplicate addresses, and does not reveal list membership. Database failures do not claim successful signup.
- Both applications deploy from `main` in **ZenfulOrg** through the **Zenful / zenfully** Vercel team. The domain can be connected later without changing the signup allowlist for `emotionarybook.com`.
- Removal requests currently go to support@emotionarybook.com. Record unsubscribe requests in `book_waitlist` (`status=unsubscribed`, `unsubscribed_at=now()`) before preparing an Active export. Campaign sending and automated unsubscribe links belong to the email provider chosen later.

## Supabase advisor review

The two tables deliberately have RLS and no public policies; the advisor's informational [RLS-without-policy notice](https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy) reflects the intended server-only design. No anonymous/authenticated table privileges are granted. The project also reports an existing, unrelated [Supabase Auth leaked-password protection setting](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection); this work does not change app authentication.

Supabase stores the list; this feature does not send campaigns. The team can export to a mail platform later.

## Verification

`npm run test:schema` runs the actual migration in local PGlite/Postgres, verifies constraints, duplicate handling, and denied public access without touching a remote database.

`npm run build && npm run test:browser` exercises the production build against a loopback-only mock Supabase API containing synthetic example.com addresses. It verifies 1,200+ row exports despite a simulated 100-row API cap, auth denial, date/email filters, pagination, clipboard fallback, and error states. Tests use installed Google Chrome.

`npm run preview:waitlist` starts the same synthetic preview at http://127.0.0.1:4397; local test password: `local-test-password`. This runner never uses production credentials and must not be used as the deployed start command.

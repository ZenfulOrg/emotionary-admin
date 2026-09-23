# Emotionary Admin

Internal password-protected admin interface for managing rows in the Emotionary
Supabase `public.words` table.

## Features

- Password-protected access with an HTTP-only signed session cookie
- Server-only Supabase service-role client
- Add and edit words
- Save drafts, publish, and unpublish words
- Search and filter by status, type, level, and free/paid access
- Mobile-style preview of the selected word
- Book waitlist with signup timestamps, email/date/status filters, copy-all, and CSV export

The book waitlist is prepared locally; its database migration and public-site integration are not activated. See [book waitlist setup and verification](docs/book-waitlist.md).

## Environment

Create `.env.local` from `.env.example`.

```bash
cp .env.example .env.local
```

Required variables:

```bash
SUPABASE_URL=https://zqrdwqvkofhxfxkondmx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
ADMIN_PASSWORD=choose-a-strong-admin-password
ADMIN_SESSION_SECRET=openssl-rand-base64-32-output
```

On Vercel, `AUTH_SECRET` can be used instead of `ADMIN_SESSION_SECRET`.

Generate a session secret with:

```bash
openssl rand -base64 32
```

`SUPABASE_SERVICE_ROLE_KEY` must never be exposed to the mobile app or committed
to git. This app only reads it from server-side code.

## Development

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Verification

```bash
npm run lint
npm run build
```

## Deploy

This app is ready for Vercel. Set the same required environment variables in the
Vercel project before using the admin UI in production.

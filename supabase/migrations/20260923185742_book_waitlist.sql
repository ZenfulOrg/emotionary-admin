-- Emotionary (zqrdwqvkofhxfxkondmx); deployed with book_waitlist_and_signup.
-- Website submissions must go through a protected server endpoint, never direct anon inserts.
create table public.book_waitlist (
  id bigint generated always as identity primary key,
  email text not null unique,
  created_at timestamptz not null default now(),
  source text not null default 'website',
  status text not null default 'active' check (status in ('active', 'unsubscribed')),
  consent_version text not null,
  unsubscribed_at timestamptz,
  constraint book_waitlist_email_normalized check (email = lower(btrim(email))),
  constraint book_waitlist_email_valid check (
    char_length(email) between 3 and 254
    and email ~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
  ),
  constraint book_waitlist_source_length check (char_length(source) between 1 and 80),
  constraint book_waitlist_consent_length check (char_length(consent_version) between 1 and 80),
  constraint book_waitlist_unsubscribe_consistent check (
    (status = 'active' and unsubscribed_at is null)
    or (status = 'unsubscribed' and unsubscribed_at is not null)
  )
);

create index book_waitlist_created_at_id_idx on public.book_waitlist (created_at desc, id desc);
create index book_waitlist_status_created_at_idx on public.book_waitlist (status, created_at desc, id desc);

alter table public.book_waitlist enable row level security;
revoke all on table public.book_waitlist from public, anon, authenticated, service_role;
revoke all on sequence public.book_waitlist_id_seq from public, anon, authenticated, service_role;
grant select, insert, update on table public.book_waitlist to service_role;
grant usage on sequence public.book_waitlist_id_seq to service_role;

comment on table public.book_waitlist is 'Book-launch signups. Accessible only to server-side service role behind admin authorization. Active does not mean email-verified.';
comment on column public.book_waitlist.created_at is 'Original signup timestamp. Duplicate submissions must use ON CONFLICT (email) DO NOTHING to preserve this timestamp and unsubscribe status.';
comment on column public.book_waitlist.consent_version is 'Identifier for the exact launch-notification consent copy shown when the visitor signed up.';

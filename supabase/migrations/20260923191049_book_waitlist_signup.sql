-- Shared, atomic rate limits; no raw IP addresses are retained.
create table public.book_waitlist_rate_limits (
  bucket text primary key,
  hits integer not null check (hits > 0),
  expires_at timestamptz not null
);
alter table public.book_waitlist_rate_limits enable row level security;
revoke all on public.book_waitlist_rate_limits from public, anon, authenticated, service_role;
grant select, insert, update, delete on public.book_waitlist_rate_limits to service_role;
create index book_waitlist_rate_expiry_idx on public.book_waitlist_rate_limits (expires_at);

create function public.submit_book_waitlist(p_email text, p_ip_hash text)
returns boolean
language plpgsql
security invoker
set search_path = ''
as $$
declare
  signup_time timestamptz := now();
  client_bucket text;
  global_bucket text;
  client_hits integer;
  global_hits integer;
begin
  if p_ip_hash is null or p_ip_hash !~ '^[a-f0-9]{64}$' then
    raise exception 'Invalid rate limit key';
  end if;
  if p_email is null or char_length(p_email) > 254 or p_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then
    raise exception 'Invalid email';
  end if;
  delete from public.book_waitlist_rate_limits where expires_at < signup_time;
  client_bucket := 'ip:' || p_ip_hash || ':' || floor(extract(epoch from signup_time) / 900)::text;
  global_bucket := 'global:' || floor(extract(epoch from signup_time) / 3600)::text;
  -- Consistent lock order serializes concurrent submissions without lost increments.
  insert into public.book_waitlist_rate_limits as limits (bucket, hits, expires_at)
    values (global_bucket, 1, signup_time + interval '1 hour')
    on conflict (bucket) do update set hits = limits.hits + 1
    returning hits into global_hits;
  insert into public.book_waitlist_rate_limits as limits (bucket, hits, expires_at)
    values (client_bucket, 1, signup_time + interval '15 minutes')
    on conflict (bucket) do update set hits = limits.hits + 1
    returning hits into client_hits;
  if client_hits > 10 or global_hits > 1000 then
    return false;
  end if;
  insert into public.book_waitlist (email, source, consent_version)
    values (lower(btrim(p_email)), 'website', 'book-launch-2026-09-23')
    on conflict (email) do nothing;
  return true;
end;
$$;
revoke all on function public.submit_book_waitlist(text, text) from public, anon, authenticated;
grant execute on function public.submit_book_waitlist(text, text) to service_role;
comment on function public.submit_book_waitlist(text, text) is 'Server-only book signup. Preserves original signup date and unsubscribe status. Atomic limits: 10/IP/15min, 1000 total/hour.';

import "server-only";
import { assertAdminSession } from "@/lib/auth";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import {
  WAITLIST_PAGE_SIZE,
  type WaitlistFilters,
  type WaitlistSubscriber,
} from "@/lib/waitlist";

const columns = "id,email,created_at,source,status,consent_version";

function filteredQuery(filters: WaitlistFilters, count = false) {
  let query = getSupabaseAdmin()
    .from("book_waitlist")
    .select(columns, count ? { count: "exact" } : undefined);
  if (filters.q)
    query = query.ilike("email", `%${filters.q.replace(/[\\%_*]/g, "\\$&")}%`);
  if (filters.status !== "all") query = query.eq("status", filters.status);
  if (filters.from)
    query = query.gte("created_at", `${filters.from}T00:00:00.000Z`);
  if (filters.to) {
    const nextDay = new Date(`${filters.to}T00:00:00.000Z`);
    nextDay.setUTCDate(nextDay.getUTCDate() + 1);
    query = query.lt("created_at", nextDay.toISOString());
  }
  return query;
}

function queryError(code?: string): never {
  if (code === "PGRST205" || code === "42P01") {
    throw new Error(
      "The book waitlist is not connected yet. Its database setup is ready for the connection step.",
    );
  }
  throw new Error(
    "The waitlist could not be loaded. Please try again or check the Supabase connection.",
  );
}

export async function listWaitlist(filters: WaitlistFilters) {
  await assertAdminSession();
  const offset = (filters.page - 1) * WAITLIST_PAGE_SIZE;
  const { data, count, error } = await filteredQuery(filters, true)
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })
    .range(offset, offset + WAITLIST_PAGE_SIZE - 1);
  if (error) queryError(error.code);
  return { rows: (data ?? []) as WaitlistSubscriber[], total: count ?? 0 };
}

export async function exportWaitlist(filters: WaitlistFilters) {
  await assertAdminSession();
  // Capture the highest ID so new signups cannot shift an export between batches.
  const upper = await filteredQuery(filters)
    .order("id", { ascending: false })
    .limit(1);
  if (upper.error) queryError(upper.error.code);
  const maxId = upper.data?.[0]?.id;
  if (maxId == null) return [];
  let cursor = 0;
  const rows: WaitlistSubscriber[] = [];
  while (true) {
    const { data, error } = await filteredQuery(filters)
      .gt("id", cursor)
      .lte("id", maxId)
      .order("id", { ascending: true })
      .limit(500);
    if (error) queryError(error.code);
    const batch = (data ?? []) as WaitlistSubscriber[];
    if (!batch.length) break;
    rows.push(...batch);
    const next = batch[batch.length - 1].id;
    if (next <= cursor)
      throw new Error("Export could not finish. Please retry.");
    cursor = next;
  }
  return rows;
}

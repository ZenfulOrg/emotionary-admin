import Link from "next/link";
import { LogOut, Mail } from "lucide-react";
import { logoutAction } from "@/app/actions";
import { AdminNavigation } from "@/components/admin/admin-navigation";
import { WaitlistActions } from "@/components/admin/waitlist-actions";
import { requireAdmin } from "@/lib/auth";
import { getSupabaseConfigStatus } from "@/lib/supabase-admin";
import { listWaitlist } from "@/lib/waitlist-data";
import {
  formatSignupDate,
  parseWaitlistFilters,
  waitlistParams,
  WAITLIST_PAGE_SIZE,
  type WaitlistSubscriber,
} from "@/lib/waitlist";

export const metadata = {
  title: "Book waitlist · Emotionary Admin",
  robots: { index: false, follow: false },
};

export default async function WaitlistPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireAdmin();
  const raw = await searchParams;
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(raw))
    if (typeof value === "string") params.set(key, value);
  let filters = parseWaitlistFilters(new URLSearchParams());
  let error: string | null = null;
  let rows: WaitlistSubscriber[] = [];
  let total = 0;
  try {
    filters = parseWaitlistFilters(params);
  } catch {
    error =
      "Check the date range and search filters. The start date must be on or before the end date.";
  }
  if (!error && !getSupabaseConfigStatus().hasServiceRoleKey)
    error =
      "The waitlist connection is not configured on this admin yet. The page is ready for setup.";
  if (!error) {
    try {
      ({ rows, total } = await listWaitlist(filters));
    } catch (caught) {
      error =
        caught instanceof Error
          ? caught.message
          : "Unable to load the waitlist.";
    }
  }
  const pages = Math.max(1, Math.ceil(total / WAITLIST_PAGE_SIZE));
  const input =
    "mt-1 min-h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-950 focus:border-emerald-600 focus:outline-2 focus:outline-emerald-600";
  return (
    <main className="min-h-screen">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-5 sm:px-6 lg:px-8">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.16em] text-emerald-700">
              Emotionary
            </p>
            <h1 className="mt-1 text-2xl font-semibold text-slate-950">
              Book waitlist
            </h1>
          </div>
          <form action={logoutAction}>
            <button
              type="submit"
              aria-label="Sign out"
              className="inline-flex size-11 items-center justify-center rounded-lg border border-slate-300 bg-white text-slate-600"
            >
              <LogOut size={17} aria-hidden="true" />
            </button>
          </form>
        </div>
      </header>
      <AdminNavigation current="waitlist" />
      <div className="mx-auto max-w-7xl space-y-6 px-4 py-6 sm:px-6 lg:px-8">
        {process.env.EMOTIONARY_LOCAL_PREVIEW === "true" && (
          <p className="rounded-lg border border-blue-200 bg-blue-50 p-4 text-sm text-blue-900">
            Local preview — these are synthetic example.com addresses. No real
            signups or live Supabase data.
          </p>
        )}
        <p className="max-w-2xl text-sm leading-6 text-slate-600">
          Everyone who asked to hear when the Emotionary book is ready. Search
          signups, check when they joined, and copy or export the list for your
          team.
        </p>
        {error && (
          <div
            role="alert"
            className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950"
          >
            {error}
          </div>
        )}
        <section
          aria-label="Waitlist filters"
          className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm"
        >
          <form
            method="get"
            action="/waitlist"
            className="grid items-end gap-3 sm:grid-cols-2 lg:grid-cols-[minmax(200px,1fr)_150px_150px_150px_auto_auto]"
          >
            <label className="text-sm font-medium text-slate-700">
              Search email
              <input
                className={input}
                type="search"
                name="q"
                defaultValue={params.get("q") ?? ""}
                placeholder="Search by email"
                maxLength={254}
              />
            </label>
            <label className="text-sm font-medium text-slate-700">
              From (UTC)
              <input
                className={input}
                name="from"
                type="date"
                defaultValue={params.get("from") ?? ""}
              />
            </label>
            <label className="text-sm font-medium text-slate-700">
              Through (UTC)
              <input
                className={input}
                name="to"
                type="date"
                defaultValue={params.get("to") ?? ""}
              />
            </label>
            <label className="text-sm font-medium text-slate-700">
              Status
              <select
                className={input}
                name="status"
                defaultValue={filters.status}
              >
                <option value="all">All signups</option>
                <option value="active">Active</option>
                <option value="unsubscribed">Unsubscribed</option>
              </select>
            </label>
            <button
              className="min-h-11 rounded-lg bg-slate-950 px-4 text-sm font-semibold text-white hover:bg-slate-800"
              type="submit"
            >
              Apply filters
            </button>
            <Link
              href="/waitlist"
              className="flex min-h-11 items-center justify-center px-3 text-sm font-medium text-slate-600 underline underline-offset-4"
            >
              Reset
            </Link>
          </form>
        </section>
        <section
          aria-labelledby="signups-title"
          className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm"
        >
          <div className="space-y-4 border-b border-slate-200 p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2
                id="signups-title"
                className="text-lg font-semibold text-slate-950"
              >
                {error
                  ? "Signups"
                  : `${total.toLocaleString()} matching ${total === 1 ? "signup" : "signups"}`}
              </h2>
              <span className="text-xs text-slate-600">
                All dates shown in UTC
              </span>
            </div>
            <WaitlistActions
              key={waitlistParams(filters).toString()}
              query={waitlistParams(filters, 1).toString()}
              disabled={Boolean(error) || total === 0}
            />
            <p className="text-xs leading-5 text-slate-600">
              Copy and export include every matching signup across all pages.
              Choose Active before preparing a mailing list. Addresses have not
              been email-verified unless a confirmation flow is connected.
            </p>
          </div>
          {rows.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <caption className="sr-only">
                  Book waitlist subscribers and signup dates
                </caption>
                <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-600">
                  <tr>
                    <th scope="col" className="px-5 py-3">
                      Email
                    </th>
                    <th scope="col" className="px-5 py-3">
                      Signed up (UTC)
                    </th>
                    <th scope="col" className="px-5 py-3">
                      Source
                    </th>
                    <th scope="col" className="px-5 py-3">
                      Status
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {rows.map((row) => (
                    <tr key={row.id} className="hover:bg-slate-50">
                      <td className="px-5 py-4 font-medium text-slate-950">
                        {row.email}
                      </td>
                      <td className="whitespace-nowrap px-5 py-4 text-slate-600">
                        <time dateTime={row.created_at}>
                          {formatSignupDate(row.created_at)}
                        </time>
                      </td>
                      <td className="px-5 py-4 text-slate-600">
                        {row.source === "website" ? "Book website" : row.source}
                      </td>
                      <td className="px-5 py-4">
                        <span
                          className={`rounded-full px-2.5 py-1 text-xs font-medium ${row.status === "active" ? "bg-emerald-50 text-emerald-800" : "bg-slate-100 text-slate-700"}`}
                        >
                          {row.status === "active" ? "Active" : "Unsubscribed"}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="px-5 py-16 text-center">
              <Mail
                className="mx-auto mb-4 text-slate-400"
                size={28}
                aria-hidden="true"
              />
              <h3 className="font-semibold text-slate-950">
                {error ? "Ready for connection" : "No signups to show"}
              </h3>
              <p className="mt-2 text-sm text-slate-600">
                {error
                  ? "Signups will appear here once the waitlist is connected."
                  : "Try changing the filters, or check back after someone joins."}
              </p>
            </div>
          )}
          {!error && total > 0 && (
            <nav
              aria-label="Waitlist pagination"
              className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 px-5 py-4 text-sm text-slate-600"
            >
              <span>
                Page {filters.page.toLocaleString()} of {pages.toLocaleString()}{" "}
                · {WAITLIST_PAGE_SIZE} per page
              </span>
              <div className="flex gap-4">
                {filters.page > 1 && (
                  <Link
                    href={`/waitlist?${waitlistParams(filters, Math.min(pages, filters.page - 1))}`}
                    className="underline underline-offset-4"
                  >
                    Previous
                  </Link>
                )}
                {filters.page < pages && (
                  <Link
                    href={`/waitlist?${waitlistParams(filters, filters.page + 1)}`}
                    className="underline underline-offset-4"
                  >
                    Next
                  </Link>
                )}
              </div>
            </nav>
          )}
        </section>
      </div>
    </main>
  );
}

import { Bell, LogOut } from "lucide-react";

import { logoutAction } from "@/app/actions";
import {
  cancelMessageAction,
  saveTriggerAction,
  sendMessageAction,
  setLiveAction,
} from "@/app/notifications/actions";
import { AdminNavigation } from "@/components/admin/admin-navigation";
import { LocalDateTimeInput } from "@/components/admin/local-datetime-input";
import { requireAdmin } from "@/lib/auth";
import {
  getPushOverview,
  listPushMessages,
  listPushTriggers,
  type PushMessage,
  type PushOverview,
  type PushTrigger,
} from "@/lib/push-admin";
import { getSupabaseConfigStatus } from "@/lib/supabase-admin";

export const metadata = {
  title: "Notifications · Emotionary Admin",
  robots: { index: false, follow: false },
};

const input =
  "mt-1 min-h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-950 focus:border-emerald-600 focus:outline-2 focus:outline-emerald-600";
const button =
  "min-h-11 rounded-lg bg-slate-950 px-4 text-sm font-semibold text-white hover:bg-slate-800";
const card = "rounded-xl border border-slate-200 bg-white p-5 shadow-sm";

const TRIGGER_COPY: Record<PushTrigger["kind"], { name: string; rule: string; daysLabel?: string }> = {
  streak_rescue: {
    name: "Streak reminder",
    rule: "Someone with a streak hasn't opened the app today.",
  },
  inactive_days: {
    name: "Come back",
    rule: "Someone hasn't opened the app for this many days.",
    daysLabel: "Days away",
  },
  streak_milestone: {
    name: "Streak milestone",
    rule: "Someone's streak reaches this many days.",
    daysLabel: "Streak length",
  },
  days_since_install: {
    name: "Days since install",
    rule: "This many days after someone installs the app.",
    daysLabel: "Days after install",
  },
};

const AUDIENCE = { all: "Everyone", free: "Free plan", paid: "Paid plan" } as const;
const STATUS: Record<PushMessage["status"], string> = {
  draft: "Draft",
  queued: "Queued",
  sending: "Sending",
  sent: "Sent",
  cancelled: "Cancelled",
};

function hourLabel(hour: number) {
  const suffix = hour < 12 ? "am" : "pm";
  const twelve = hour % 12 === 0 ? 12 : hour % 12;
  return `${twelve}${suffix}`;
}

function when(iso: string | null) {
  if (!iso) return "As soon as possible";
  return new Date(iso).toLocaleString("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "UTC",
  }) + " UTC";
}

export default async function NotificationsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireAdmin();
  const params = await searchParams;
  const notice = typeof params.notice === "string" ? params.notice : null;
  let error = typeof params.error === "string" ? params.error : null;

  let overview: PushOverview | null = null;
  let messages: PushMessage[] = [];
  let triggers: PushTrigger[] = [];
  if (!getSupabaseConfigStatus().hasServiceRoleKey) {
    error = "The Supabase connection is not configured on this admin yet.";
  } else {
    try {
      [overview, messages, triggers] = await Promise.all([
        getPushOverview(),
        listPushMessages(),
        listPushTriggers(),
      ]);
    } catch (caught) {
      error = caught instanceof Error ? caught.message : "Unable to load notifications.";
    }
  }

  return (
    <main className="min-h-screen">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-5 sm:px-6 lg:px-8">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.16em] text-emerald-700">
              Emotionary
            </p>
            <h1 className="mt-1 text-2xl font-semibold text-slate-950">Notifications</h1>
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
      <AdminNavigation current="notifications" />

      <div className="mx-auto max-w-7xl space-y-6 px-4 py-6 sm:px-6 lg:px-8">
        <p className="max-w-2xl text-sm leading-6 text-slate-600">
          The daily word goes out on its own at each person&apos;s chosen time, cycling through
          every published word. Send a one-off message to everyone, or edit the messages that go
          out automatically. Nothing here needs an app update.
        </p>
        {notice && (
          <p role="status" className="rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900">
            {notice}
          </p>
        )}
        {error && (
          <p role="alert" className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950">
            {error}
          </p>
        )}

        {overview && (
          <section aria-labelledby="status-title" className={card}>
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <h2 id="status-title" className="text-lg font-semibold text-slate-950">
                  Server notifications are {overview.live ? "on" : "off"}
                </h2>
                <p className="mt-1 max-w-xl text-sm leading-6 text-slate-600">
                  {overview.live
                    ? "The server sends the daily word and the automatic messages. One-off messages always come from here."
                    : "Phones schedule their own daily word for now. Turn this on once a test on a real phone works; one-off messages already send while it's off."}
                </p>
              </div>
              <form action={setLiveAction}>
                <input type="hidden" name="live" value={overview.live ? "false" : "true"} />
                <button type="submit" className={overview.live ? `${button} bg-white !text-slate-950 border border-slate-300 hover:bg-slate-50` : button}>
                  {overview.live ? "Turn off" : "Turn on"}
                </button>
              </form>
            </div>
            <dl className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-5">
              {[
                ["Phones with notifications on", overview.devices.total],
                ["iPhone", overview.devices.ios],
                ["Android", overview.devices.android],
                ["Free plan", overview.devices.free],
                ["Paid plan", overview.devices.paid],
              ].map(([label, value]) => (
                <div key={label} className="rounded-lg bg-slate-50 p-3">
                  <dt className="text-xs text-slate-600">{label}</dt>
                  <dd className="mt-1 text-xl font-semibold text-slate-950">{Number(value).toLocaleString()}</dd>
                </div>
              ))}
            </dl>
          </section>
        )}

        <section aria-labelledby="compose-title" className={card}>
          <h2 id="compose-title" className="text-lg font-semibold text-slate-950">
            Send a message
          </h2>
          <form action={sendMessageAction} className="mt-4 grid gap-4 lg:grid-cols-2">
            <label className="text-sm font-medium text-slate-700">
              Title
              <input className={input} name="title" required maxLength={120} placeholder="A new word just landed" />
            </label>
            <label className="text-sm font-medium text-slate-700">
              Opens
              <input className={input} name="url" defaultValue="/" pattern="/[A-Za-z0-9/_?=&.\-]*" title="An in-app path like / or /paywall" />
              <span className="mt-1 block text-xs font-normal text-slate-500">
                / is today&apos;s word, /paywall the plans, /word/toska a word.
              </span>
            </label>
            <label className="text-sm font-medium text-slate-700 lg:col-span-2">
              Message
              <textarea className={`${input} min-h-24 py-2`} name="body" required maxLength={400} />
            </label>
            <label className="text-sm font-medium text-slate-700">
              Who
              <select className={input} name="audience" defaultValue="all">
                <option value="all">Everyone</option>
                <option value="free">Free plan</option>
                <option value="paid">Paid plan</option>
              </select>
            </label>
            <label className="text-sm font-medium text-slate-700">
              Phones
              <select className={input} name="platform" defaultValue="all">
                <option value="all">iPhone and Android</option>
                <option value="ios">iPhone only</option>
                <option value="android">Android only</option>
              </select>
            </label>
            <fieldset className="text-sm font-medium text-slate-700 lg:col-span-2">
              <legend>When</legend>
              <div className="mt-2 flex flex-wrap items-center gap-4">
                <label className="inline-flex items-center gap-2 font-normal">
                  <input type="radio" name="when" value="now" defaultChecked /> Now
                </label>
                <label className="inline-flex items-center gap-2 font-normal">
                  <input type="radio" name="when" value="later" /> Later, at
                </label>
                <div className="w-64">
                  <LocalDateTimeInput name="sendAfter" className={input} />
                </div>
              </div>
            </fieldset>
            <div className="lg:col-span-2">
              <button type="submit" className={button}>
                Send
              </button>
            </div>
          </form>
        </section>

        <section aria-labelledby="history-title" className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <h2 id="history-title" className="border-b border-slate-200 p-5 text-lg font-semibold text-slate-950">
            Sent and scheduled
          </h2>
          {messages.length === 0 ? (
            <div className="px-5 py-12 text-center">
              <Bell className="mx-auto mb-3 text-slate-400" size={26} aria-hidden="true" />
              <p className="text-sm text-slate-600">No messages yet.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-600">
                  <tr>
                    <th scope="col" className="px-5 py-3">Message</th>
                    <th scope="col" className="px-5 py-3">Who</th>
                    <th scope="col" className="px-5 py-3">When</th>
                    <th scope="col" className="px-5 py-3">Status</th>
                    <th scope="col" className="px-5 py-3">Delivered</th>
                    <th scope="col" className="px-5 py-3"><span className="sr-only">Actions</span></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {messages.map((message) => (
                    <tr key={message.id}>
                      <td className="max-w-md px-5 py-4">
                        <p className="font-medium text-slate-950">{message.title}</p>
                        <p className="mt-1 text-slate-600">{message.body}</p>
                      </td>
                      <td className="whitespace-nowrap px-5 py-4 text-slate-600">
                        {AUDIENCE[message.audience]}
                        {message.platform ? ` · ${message.platform === "ios" ? "iPhone" : "Android"}` : ""}
                      </td>
                      <td className="whitespace-nowrap px-5 py-4 text-slate-600">
                        {when(message.finished_at ?? message.send_after)}
                      </td>
                      <td className="px-5 py-4 text-slate-600">{STATUS[message.status]}</td>
                      <td className="whitespace-nowrap px-5 py-4 text-slate-600">
                        {message.status === "sent"
                          ? `${message.sent_count.toLocaleString()}${message.failed_count ? ` (${message.failed_count} failed)` : ""}`
                          : "—"}
                      </td>
                      <td className="px-5 py-4 text-right">
                        {message.status === "queued" && (
                          <form action={cancelMessageAction}>
                            <input type="hidden" name="id" value={message.id} />
                            <button type="submit" className="text-sm font-medium text-slate-600 underline underline-offset-4">
                              Cancel
                            </button>
                          </form>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section aria-labelledby="triggers-title" className="space-y-4">
          <div>
            <h2 id="triggers-title" className="text-lg font-semibold text-slate-950">
              Automatic messages
            </h2>
            <p className="mt-1 max-w-2xl text-sm leading-6 text-slate-600">
              Sent once per person when the rule matches, at the hour you pick in their own time
              zone. They start once server notifications are on.
            </p>
          </div>
          {triggers.map((trigger) => {
            const copy = TRIGGER_COPY[trigger.kind];
            return (
              <form key={trigger.id} action={saveTriggerAction} className={`${card} grid gap-4 lg:grid-cols-4`}>
                <input type="hidden" name="id" value={trigger.id} />
                <div className="lg:col-span-4 flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h3 className="font-semibold text-slate-950">{copy.name}</h3>
                    <p className="text-sm text-slate-600">{copy.rule}</p>
                  </div>
                  <label className="inline-flex items-center gap-2 text-sm font-medium text-slate-700">
                    <input type="checkbox" name="enabled" defaultChecked={trigger.enabled} className="size-4" />
                    On
                  </label>
                </div>
                <label className="text-sm font-medium text-slate-700 lg:col-span-2">
                  Title
                  <input className={input} name="title" defaultValue={trigger.title} required maxLength={120} />
                </label>
                <label className="text-sm font-medium text-slate-700 lg:col-span-2">
                  Opens
                  <input className={input} name="url" defaultValue={trigger.url} pattern="/[A-Za-z0-9/_?=&.\-]*" />
                </label>
                <label className="text-sm font-medium text-slate-700 lg:col-span-4">
                  Message
                  <textarea className={`${input} min-h-20 py-2`} name="body" defaultValue={trigger.body} required maxLength={400} />
                </label>
                {copy.daysLabel ? (
                  <label className="text-sm font-medium text-slate-700">
                    {copy.daysLabel}
                    <input className={input} type="number" name="days" min={1} max={3650} defaultValue={trigger.days ?? ""} required />
                  </label>
                ) : (
                  <input type="hidden" name="days" value="" />
                )}
                <label className="text-sm font-medium text-slate-700">
                  Sends at
                  <select className={input} name="send_hour" defaultValue={trigger.send_hour}>
                    {Array.from({ length: 24 }, (_, hour) => (
                      <option key={hour} value={hour}>
                        {hourLabel(hour)} their time
                      </option>
                    ))}
                  </select>
                </label>
                <label className="text-sm font-medium text-slate-700">
                  Who
                  <select className={input} name="audience" defaultValue={trigger.audience}>
                    <option value="all">Everyone</option>
                    <option value="free">Free plan</option>
                    <option value="paid">Paid plan</option>
                  </select>
                </label>
                <div className="flex items-end">
                  <button type="submit" className={button}>
                    Save
                  </button>
                </div>
              </form>
            );
          })}
        </section>
      </div>
    </main>
  );
}

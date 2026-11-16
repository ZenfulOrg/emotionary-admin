import "server-only";

import { z } from "zod";

import { getSupabaseAdmin } from "@/lib/supabase-admin";

/**
 * Push notifications, managed from the admin panel. One-off messages are
 * queued in push_messages and sent by the send-notifications Edge Function
 * (every 15 minutes, or right away with "Send now"). Triggered messages are
 * rules in push_triggers that the same function checks on every run.
 */

const FUNCTION_URL =
  "https://zqrdwqvkofhxfxkondmx.supabase.co/functions/v1/send-notifications";

export type PushMessage = {
  id: string;
  title: string;
  body: string;
  url: string;
  audience: "all" | "free" | "paid";
  platform: "ios" | "android" | null;
  send_after: string | null;
  status: "draft" | "queued" | "sending" | "sent" | "cancelled";
  sent_count: number;
  failed_count: number;
  created_at: string;
  finished_at: string | null;
};

export type PushTrigger = {
  id: string;
  kind: "streak_rescue" | "inactive_days" | "streak_milestone" | "days_since_install";
  days: number | null;
  title: string;
  body: string;
  url: string;
  audience: "all" | "free" | "paid";
  send_hour: number;
  enabled: boolean;
};

export type PushOverview = {
  live: boolean;
  devices: { total: number; ios: number; android: number; free: number; paid: number };
};

const route = z
  .string()
  .trim()
  .regex(/^\/[A-Za-z0-9/_?=&.-]*$/, "Use an in-app path that starts with /, like / or /paywall.");

export const messageInput = z.object({
  title: z.string().trim().min(1, "Add a title.").max(120),
  body: z.string().trim().min(1, "Add a message.").max(400),
  url: route.default("/"),
  audience: z.enum(["all", "free", "paid"]),
  platform: z.enum(["all", "ios", "android"]),
  sendAfter: z.string().datetime({ offset: true }).nullable(),
});

export const triggerInput = z.object({
  id: z.string().uuid(),
  title: z.string().trim().min(1, "Add a title.").max(120),
  body: z.string().trim().min(1, "Add a message.").max(400),
  url: route,
  audience: z.enum(["all", "free", "paid"]),
  days: z.coerce.number().int().min(1).max(3650).nullable(),
  send_hour: z.coerce.number().int().min(0).max(23),
  enabled: z.boolean(),
});

export async function getPushOverview(): Promise<PushOverview> {
  const supabase = getSupabaseAdmin();
  const [{ data: settings }, { data: devices, error }] = await Promise.all([
    supabase.from("push_settings").select("push_live").single(),
    supabase.from("push_devices").select("platform, plan").eq("enabled", true).limit(100000),
  ]);
  if (error) throw new Error(error.message);
  const rows = devices ?? [];
  return {
    live: settings?.push_live === true,
    devices: {
      total: rows.length,
      ios: rows.filter((row) => row.platform === "ios").length,
      android: rows.filter((row) => row.platform === "android").length,
      free: rows.filter((row) => row.plan === "free").length,
      paid: rows.filter((row) => row.plan === "paid").length,
    },
  };
}

export async function listPushMessages(): Promise<PushMessage[]> {
  const { data, error } = await getSupabaseAdmin()
    .from("push_messages")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(50);
  if (error) throw new Error(error.message);
  return (data ?? []) as PushMessage[];
}

export async function listPushTriggers(): Promise<PushTrigger[]> {
  const { data, error } = await getSupabaseAdmin()
    .from("push_triggers")
    .select("*")
    .order("created_at", { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []) as PushTrigger[];
}

export async function createPushMessage(input: z.infer<typeof messageInput>) {
  const { data, error } = await getSupabaseAdmin()
    .from("push_messages")
    .insert({
      title: input.title,
      body: input.body,
      url: input.url,
      audience: input.audience,
      platform: input.platform === "all" ? null : input.platform,
      send_after: input.sendAfter,
      status: "queued",
    })
    .select("id")
    .single();
  if (error) throw new Error(error.message);
  return data.id as string;
}

export async function cancelPushMessage(id: string) {
  const { error } = await getSupabaseAdmin()
    .from("push_messages")
    .update({ status: "cancelled" })
    .eq("id", id)
    .eq("status", "queued");
  if (error) throw new Error(error.message);
}

export async function updatePushTrigger(input: z.infer<typeof triggerInput>) {
  const { error } = await getSupabaseAdmin()
    .from("push_triggers")
    .update({
      title: input.title,
      body: input.body,
      url: input.url,
      audience: input.audience,
      days: input.days,
      send_hour: input.send_hour,
      enabled: input.enabled,
      updated_at: new Date().toISOString(),
    })
    .eq("id", input.id);
  if (error) throw new Error(error.message);
}

export async function setPushLive(live: boolean) {
  const { error } = await getSupabaseAdmin()
    .from("push_settings")
    .update({ push_live: live })
    .eq("id", true);
  if (error) throw new Error(error.message);
}

/** Runs the sender now for queued one-offs (no waiting for the next 15-minute run). */
export async function runSenderNow() {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase.from("push_cron_secret").select("secret").single();
  if (error || !data?.secret) throw new Error("The push sender is not set up yet.");
  const response = await fetch(FUNCTION_URL, {
    method: "POST",
    headers: { "content-type": "application/json", "x-push-secret": data.secret },
    body: JSON.stringify({ only: "messages" }),
    signal: AbortSignal.timeout(60_000),
  });
  const result = (await response.json().catch(() => null)) as {
    ok?: boolean;
    apnsConfigured?: boolean;
    error?: string;
  } | null;
  if (!response.ok || !result?.ok) {
    throw new Error(result?.error ?? `The push sender failed (${response.status}).`);
  }
  return { apnsConfigured: result.apnsConfigured === true };
}

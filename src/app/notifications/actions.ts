"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { assertAdminSession } from "@/lib/auth";
import {
  cancelPushMessage,
  createPushMessage,
  messageInput,
  runSenderNow,
  setPushLive,
  triggerInput,
  updatePushTrigger,
} from "@/lib/push-admin";

function back(kind: "notice" | "error", text: string): never {
  revalidatePath("/notifications");
  redirect(`/notifications?${new URLSearchParams({ [kind]: text })}`);
}

function problem(error: unknown) {
  if (error instanceof z.ZodError) return error.issues[0]?.message ?? "Check the form.";
  return error instanceof Error ? error.message : "Something went wrong.";
}

function text(formData: FormData, name: string) {
  const value = formData.get(name);
  return typeof value === "string" ? value : "";
}

export async function sendMessageAction(formData: FormData) {
  await assertAdminSession();
  const schedule = text(formData, "when") === "later";
  let notice: string;
  try {
    const input = messageInput.parse({
      title: text(formData, "title"),
      body: text(formData, "body"),
      url: text(formData, "url") || "/",
      audience: text(formData, "audience"),
      platform: text(formData, "platform"),
      sendAfter: schedule ? text(formData, "sendAfter") || null : null,
    });
    if (schedule && !input.sendAfter) throw new Error("Pick when to send it.");
    if (input.sendAfter && Date.parse(input.sendAfter) < Date.now() - 60_000) {
      throw new Error("That time has already passed.");
    }
    await createPushMessage(input);
    if (schedule) {
      notice = "Scheduled. It goes out within 15 minutes of the time you picked.";
    } else {
      const { apnsConfigured } = await runSenderNow();
      notice = apnsConfigured
        ? "Sent."
        : "Queued, but Apple push isn't connected yet, so nothing went out. It stays queued until it is.";
    }
  } catch (error) {
    back("error", problem(error));
  }
  back("notice", notice);
}

export async function cancelMessageAction(formData: FormData) {
  await assertAdminSession();
  try {
    await cancelPushMessage(z.string().uuid().parse(text(formData, "id")));
  } catch (error) {
    back("error", problem(error));
  }
  back("notice", "Cancelled.");
}

export async function saveTriggerAction(formData: FormData) {
  await assertAdminSession();
  try {
    const days = text(formData, "days");
    await updatePushTrigger(
      triggerInput.parse({
        id: text(formData, "id"),
        title: text(formData, "title"),
        body: text(formData, "body"),
        url: text(formData, "url") || "/",
        audience: text(formData, "audience"),
        days: days === "" ? null : days,
        send_hour: text(formData, "send_hour"),
        enabled: formData.get("enabled") === "on",
      }),
    );
  } catch (error) {
    back("error", problem(error));
  }
  back("notice", "Saved.");
}

export async function setLiveAction(formData: FormData) {
  await assertAdminSession();
  const live = text(formData, "live") === "true";
  try {
    await setPushLive(live);
  } catch (error) {
    back("error", problem(error));
  }
  back(
    "notice",
    live
      ? "Server notifications are on. Phones switch over the next time the app opens."
      : "Server notifications are off. Phones go back to scheduling their own the next time the app opens.",
  );
}

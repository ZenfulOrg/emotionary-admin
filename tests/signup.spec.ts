import { test, expect } from "@playwright/test";

test("signup endpoint validates origin, consent, content, size and safe database responses", async ({ request }) => {
  const url = "/api/waitlist/signup";
  const headers = { Origin: "https://emotionary-website.vercel.app" };
  const data = { email: "Reader@Example.com", consent: "book-launch-2026-09-23", company: "" };
  const preflight = await request.fetch(url, { method: "OPTIONS", headers });
  expect(preflight.status()).toBe(204);
  expect(preflight.headers()["access-control-allow-origin"]).toBe(headers.Origin);
  expect((await request.post(url, { data })).status()).toBe(403);
  expect((await request.post(url, { data, headers: { Origin: "https://untrusted.example" } })).status()).toBe(403);
  expect((await request.post(url, { headers, data: { ...data, consent: "" } })).status()).toBe(400);
  expect((await request.post(url, { headers, data: { ...data, email: "invalid" } })).status()).toBe(400);
  expect((await request.post(url, { headers, data: { ...data, email: "a".repeat(3000) } })).status()).toBe(413);
  const saved = await request.post(url, { headers, data });
  expect(saved.status()).toBe(200);
  expect(await saved.json()).toEqual({ ok: true });
  expect(saved.headers()["cache-control"]).toBe("no-store");
  const limited = await request.post(url, { headers, data: { ...data, email: "limited@example.com" } });
  expect(limited.status()).toBe(429);
  expect(limited.headers()["retry-after"]).toBe("900");
  expect((await request.post(url, { headers, data: { ...data, email: "failure@example.com" } })).status()).toBe(503);
  const bot = await request.post(url, { headers, data: { ...data, email: "failure@example.com", company: "spam" } });
  expect(bot.status()).toBe(200);
});

import { test, expect, type BrowserContext } from "@playwright/test";
import { createHmac } from "node:crypto";
import { csvCell, parseWaitlistFilters } from "../src/lib/waitlist";

async function signIn(context: BrowserContext) {
  const timestamp = Date.now().toString();
  const signature = createHmac(
    "sha256",
    "local-tests-only-never-use-in-production",
  )
    .update(timestamp)
    .digest("base64url");
  await context.addCookies([
    {
      name: "emotionary_admin_session",
      value: `${timestamp}.${signature}`,
      url: "http://127.0.0.1:4397",
      httpOnly: true,
      sameSite: "Strict",
    },
  ]);
}

test("unauthenticated visitors cannot access the page or export private emails", async ({
  page,
  request,
}) => {
  await page.goto("/waitlist");
  await expect(page).toHaveURL(/\/login$/);
  for (const format of ["csv", "emails"]) {
    const response = await request.get(`/api/waitlist/export?format=${format}`);
    expect(response.status()).toBe(401);
    expect(await response.text()).not.toContain("example.com");
    expect(response.headers()["cache-control"]).toBe("private, no-store");
  }
});

test("admin can browse, search, date filter, and paginate signup dates", async ({
  page,
  context,
}) => {
  await signIn(context);
  await page.goto("/waitlist");
  await expect(
    page.getByRole("heading", { name: "Book waitlist", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "1,206 matching signups" }),
  ).toBeVisible();
  await expect(page.locator("tbody tr")).toHaveCount(50);
  await expect(
    page.getByRole("link", { name: "Book waitlist", exact: true }),
  ).toHaveAttribute("aria-current", "page");
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.getByRole("link", { name: "Next", exact: true }).click();
  await expect(page).toHaveURL(/page=2/);
  await page.getByLabel("Search email").fill("reader0001");
  await page.getByRole("button", { name: "Apply filters" }).click();
  await expect(
    page.getByRole("heading", { name: "1 matching signup", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("cell", { name: "reader0001@example.com", exact: true }),
  ).toBeVisible();
  await page.getByRole("link", { name: "Reset", exact: true }).click();
  await page.getByLabel("From (UTC)").fill("2026-09-23");
  await page.getByLabel("Through (UTC)").fill("2026-09-23");
  await page.getByRole("button", { name: "Apply filters" }).click();
  await expect(
    page.getByRole("heading", { name: "602 matching signups" }),
  ).toBeVisible();
});

test("copy/export includes all batches and respects unsubscribe filters", async ({
  page,
  context,
}) => {
  await signIn(context);
  const response = await context.request.get(
    "/api/waitlist/export?format=emails",
  );
  expect(response.ok()).toBe(true);
  const { emails } = await response.json();
  expect(emails).toHaveLength(1206);
  expect(emails).toContain("reader1205@example.com");
  expect(emails).not.toContain("unsubscribed@example.com");
  const csv = await context.request.get("/api/waitlist/export?format=csv");
  expect(csv.headers()["content-disposition"]).toContain("attachment;");
  expect((await csv.text()).trim().split("\r\n")).toHaveLength(1207);
  expect(await csv.text()).toContain("'=formula@example.com");
  const all = await context.request.get(
    "/api/waitlist/export?format=emails&status=all",
  );
  expect((await all.json()).emails).toHaveLength(1207);
  await page.addInitScript(() =>
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: {
        writeText: async () => {
          throw new Error("denied");
        },
      },
    }),
  );
  await page.goto("/waitlist");
  await page.getByRole("button", { name: "Copy all matching emails" }).click();
  await expect(page.getByLabel("Email addresses to copy")).toHaveValue(
    /reader1205@example\.com/,
  );
  const download = page.waitForEvent("download");
  await page.getByRole("link", { name: "Export CSV" }).click();
  expect((await download).suggestedFilename()).toMatch(
    /emotionary-book-waitlist/,
  );
});

test("invalid filters and backend failures do not appear as successful empty lists", async ({
  page,
  context,
}) => {
  await signIn(context);
  await page.goto("/waitlist?from=2026-09-24&to=2026-09-01");
  await expect(page.getByRole("main").getByRole("alert")).toContainText("Check the date range");
  await expect(
    page.getByRole("button", { name: "Copy all matching emails" }),
  ).toBeDisabled();
  expect(
    (await context.request.get("/api/waitlist/export?from=bad")).status(),
  ).toBe(400);
  await page.goto("/waitlist?q=simulate-error");
  await expect(page.getByRole("main").getByRole("alert")).toContainText("could not be loaded");
  expect(
    (
      await context.request.get("/api/waitlist/export?q=simulate-error")
    ).status(),
  ).toBe(503);
});

test("filters are strict and exported cells cannot execute spreadsheet formulas", () => {
  expect(() =>
    parseWaitlistFilters(new URLSearchParams("from=2026-02-30")),
  ).toThrow();
  expect(() => parseWaitlistFilters(new URLSearchParams("page=-1"))).toThrow();
  expect(csvCell("=formula@example.com")).toBe('"\'=formula@example.com"');
  expect(csvCell('a"b@example.com')).toBe('"a""b@example.com"');
});

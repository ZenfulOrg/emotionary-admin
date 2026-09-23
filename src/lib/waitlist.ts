import { z } from "zod";

export const WAITLIST_PAGE_SIZE = 50;
export type WaitlistSubscriber = {
  id: number;
  email: string;
  created_at: string;
  source: string;
  status: "active" | "unsubscribed";
  consent_version: string;
};

const filterSchema = z
  .object({
    q: z.string().trim().max(254).default(""),
    from: z.union([z.literal(""), z.iso.date()]).default(""),
    to: z.union([z.literal(""), z.iso.date()]).default(""),
    status: z.enum(["all", "active", "unsubscribed"]).default("active"),
    page: z.coerce.number().int().min(1).max(100000).default(1),
  })
  .refine((value) => !value.from || !value.to || value.from <= value.to, {
    message: "The start date must be on or before the end date.",
  });

export type WaitlistFilters = z.infer<typeof filterSchema>;

export function parseWaitlistFilters(params: URLSearchParams): WaitlistFilters {
  const values: Record<string, string> = {};
  for (const key of ["q", "from", "to", "status", "page"]) {
    const value = params.get(key);
    if (value) values[key] = value;
  }
  return filterSchema.parse(values);
}

export function waitlistParams(filters: WaitlistFilters, page = filters.page) {
  const params = new URLSearchParams();
  for (const key of ["q", "from", "to"] as const) {
    if (filters[key]) params.set(key, filters[key]);
  }
  if (filters.status !== "active") params.set("status", filters.status);
  if (page > 1) params.set("page", String(page));
  return params;
}

export function csvCell(value: string) {
  // Quotes alone do not stop spreadsheet formulas. Neutralize formula prefixes.
  const safe = /^[\s]*[=+@\-\t\r\n]/.test(value) ? `'${value}` : value;
  return `"${safe.replaceAll('"', '""')}"`;
}

export function waitlistCsv(rows: WaitlistSubscriber[]) {
  const header = [
    "Email",
    "Signed up (UTC)",
    "Source",
    "Status",
    "Consent version",
  ];
  return (
    "\uFEFF" +
    [
      header,
      ...rows.map((row) => [
        row.email,
        row.created_at,
        row.source,
        row.status,
        row.consent_version,
      ]),
    ]
      .map((row) => row.map(csvCell).join(","))
      .join("\r\n") +
    "\r\n"
  );
}

export function formatSignupDate(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "UTC",
  }).format(new Date(value));
}

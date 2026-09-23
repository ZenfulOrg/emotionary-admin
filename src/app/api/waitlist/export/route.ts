import { isAdminAuthenticated } from "@/lib/auth";
import { exportWaitlist } from "@/lib/waitlist-data";
import { parseWaitlistFilters, waitlistCsv } from "@/lib/waitlist";

export const dynamic = "force-dynamic";
const privateHeaders = {
  "Cache-Control": "private, no-store",
  "X-Content-Type-Options": "nosniff",
};

export async function GET(request: Request) {
  if (!(await isAdminAuthenticated()))
    return Response.json(
      { error: "Sign in to access the waitlist." },
      { status: 401, headers: privateHeaders },
    );
  const params = new URL(request.url).searchParams;
  let filters;
  try {
    filters = parseWaitlistFilters(params);
  } catch {
    return Response.json(
      { error: "Check the search and date filters." },
      { status: 400, headers: privateHeaders },
    );
  }
  const format = params.get("format") ?? "csv";
  if (!["csv", "emails"].includes(format))
    return Response.json(
      { error: "Unsupported export format." },
      { status: 400, headers: privateHeaders },
    );
  try {
    const rows = await exportWaitlist(filters);
    if (format === "emails") {
      return Response.json(
        { emails: [...new Set(rows.map((row) => row.email))] },
        { headers: privateHeaders },
      );
    }
    return new Response(waitlistCsv(rows), {
      headers: {
        ...privateHeaders,
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="emotionary-book-waitlist-${new Date().toISOString().slice(0, 10)}.csv"`,
      },
    });
  } catch {
    return Response.json(
      { error: "Export could not finish. Check the connection and try again." },
      { status: 503, headers: privateHeaders },
    );
  }
}

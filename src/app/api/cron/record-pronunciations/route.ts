import { recordMissingPronunciations } from "@/lib/record-missing";

export const dynamic = "force-dynamic";
// Each recording is a Google request plus an upload; a big import can take a while.
export const maxDuration = 300;

/**
 * Hourly safety net (vercel.json): any word without a recording gets one in
 * its native voice, however it was added. Words that already have audio are
 * skipped, so extra calls cost nothing. When CRON_SECRET is set in Vercel,
 * only Vercel's scheduler (which sends it) can run this.
 */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (secret && request.headers.get("authorization") !== `Bearer ${secret}`) {
    return Response.json({ error: "Unauthorized." }, { status: 401 });
  }
  try {
    const result = await recordMissingPronunciations();
    return Response.json(
      { recorded: result.recorded, tightened: result.tightened, failed: result.failed, enabled: result.enabled },
      { status: result.failed.length ? 500 : 200, headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Recording check failed." },
      { status: 500, headers: { "Cache-Control": "no-store" } },
    );
  }
}

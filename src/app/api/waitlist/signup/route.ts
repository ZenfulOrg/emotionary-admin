import { createHmac } from "node:crypto";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const MAX_BYTES = 2048;
const origins = new Set([
  "https://emotionary-website.vercel.app",
  "https://emotionarybook.com",
  "https://www.emotionarybook.com",
  ...(process.env.WAITLIST_ALLOWED_ORIGINS ?? "").split(",").map((v) => v.trim()).filter(Boolean),
  ...(process.env.EMOTIONARY_LOCAL_PREVIEW === "true" ? ["http://localhost:4173", "http://127.0.0.1:4174"] : []),
]);
function response(request: Request, status: number, body: object) {
  const origin = request.headers.get("origin") ?? "";
  return Response.json(body, {
    status,
    headers: {
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
      Vary: "Origin",
      ...(origins.has(origin) ? { "Access-Control-Allow-Origin": origin } : {}),
      ...(status === 429 ? { "Retry-After": "900" } : {}),
    },
  });
}
export async function OPTIONS(request: Request) {
  const origin = request.headers.get("origin") ?? "";
  if (!origins.has(origin)) return response(request, 403, { error: "Origin not allowed." });
  return new Response(null, { status: 204, headers: {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Max-Age": "600",
    Vary: "Origin",
  } });
}
export async function POST(request: Request) {
  if (!origins.has(request.headers.get("origin") ?? ""))
    return response(request, 403, { error: "Please join from the Emotionary website." });
  if (!request.headers.get("content-type")?.toLowerCase().startsWith("application/json"))
    return response(request, 415, { error: "Expected JSON." });
  if (Number(request.headers.get("content-length")) > MAX_BYTES)
    return response(request, 413, { error: "Request too large." });
  let body;
  try {
    const reader = request.body?.getReader();
    if (!reader) throw new Error("Empty body");
    const chunks: Uint8Array[] = [];
    let size = 0;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > MAX_BYTES) { await reader.cancel(); return response(request, 413, { error: "Request too large." }); }
      chunks.push(value);
    }
    body = JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch { return response(request, 400, { error: "Please check your email address." }); }
  if (!body || typeof body !== "object" || Array.isArray(body))
    return response(request, 400, { error: "Please check your email address." });
  // A honeypot supplements database-backed rate limiting without a third-party widget.
  if (typeof body.company === "string" && body.company.length > 0)
    return response(request, 200, { ok: true });
  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || body.consent !== "book-launch-2026-09-23")
    return response(request, 400, { error: "Please enter a valid email and accept launch notifications." });
  const secret = process.env.ADMIN_SESSION_SECRET || process.env.AUTH_SECRET;
  const ip = request.headers.get("x-vercel-forwarded-for")?.split(",")[0].trim()
    || (process.env.EMOTIONARY_LOCAL_PREVIEW === "true" ? "local-preview" : "");
  if (!secret || !ip) return response(request, 503, { error: "Signup is temporarily unavailable. Please try again shortly." });
  try {
    const hash = createHmac("sha256", secret).update(`book-waitlist:${ip}`).digest("hex");
    const { data, error } = await getSupabaseAdmin().rpc("submit_book_waitlist", { p_email: email, p_ip_hash: hash });
    if (error) throw error;
    if (data === false) return response(request, 429, { error: "Too many attempts. Please try again in 15 minutes." });
    if (data !== true) throw new Error("Unexpected signup result");
    // Same result for new, duplicate and previously unsubscribed addresses.
    return response(request, 200, { ok: true });
  } catch {
    return response(request, 503, { error: "We couldn’t save your request. Please try again shortly." });
  }
}

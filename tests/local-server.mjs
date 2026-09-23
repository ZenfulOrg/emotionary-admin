// Local browser tests only. No external services, real credentials, or real subscriber data.
import { createServer } from "node:http";
import { spawn } from "node:child_process";
const records = Array.from({ length: 1205 }, (_, i) => ({
  id: i + 1,
  email: `reader${String(i + 1).padStart(4, "0")}@example.com`,
  created_at: i % 2 ? "2026-09-23T10:30:00.000Z" : "2026-09-22T18:45:00.000Z",
  source: "website",
  status: "active",
  consent_version: "book-launch-v1",
}));
records.push({
  ...records[0],
  id: 1206,
  email: "unsubscribed@example.com",
  status: "unsubscribed",
});
records.push({ ...records[0], id: 1207, email: "=formula@example.com" });
const fixture = createServer((req, res) => {
  const url = new URL(req.url, "http://localhost");
  if (url.pathname === "/rest/v1/rpc/submit_book_waitlist") {
    let data = "";
    req.on("data", (chunk) => { data += chunk; });
    req.on("end", () => {
      const body = JSON.parse(data);
      res.writeHead(body.p_email === "failure@example.com" ? 503 : 200, { "Content-Type": "application/json" });
      res.end(JSON.stringify(body.p_email === "failure@example.com" ? { message: "Simulated DB outage" } : body.p_email !== "limited@example.com"));
    });
    return;
  }
  if (url.pathname !== "/rest/v1/book_waitlist") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end("[]");
    return;
  }
  if (url.searchParams.get("email")?.includes("simulate-error")) {
    res.writeHead(503, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ code: "TEST", message: "simulated failure" }));
    return;
  }
  let rows = records.filter((row) => {
    for (const [key, expression] of url.searchParams) {
      if (!["id", "email", "status", "created_at"].includes(key)) continue;
      const dot = expression.indexOf(".");
      const op = expression.slice(0, dot),
        value = expression.slice(dot + 1);
      const field = row[key];
      const right = key === "id" ? Number(value) : value;
      if (op === "eq" && field !== right) return false;
      if (op === "gt" && !(field > right)) return false;
      if (op === "gte" && !(field >= right)) return false;
      if (op === "lt" && !(field < right)) return false;
      if (op === "lte" && !(field <= right)) return false;
      if (
        op === "ilike" &&
        !String(field).includes(value.replace(/^%|%$/g, "").replace(/\\/g, ""))
      )
        return false;
    }
    return true;
  });
  const count = rows.length;
  const order = (url.searchParams.get("order") || "id.asc").split(",");
  rows.sort((a, b) => {
    for (const item of order) {
      const [key, dir] = item.split(".");
      const comparison = a[key] < b[key] ? -1 : a[key] > b[key] ? 1 : 0;
      if (comparison) return dir === "desc" ? -comparison : comparison;
    }
    return 0;
  });
  const offset = Number(url.searchParams.get("offset") || 0);
  // Deliberately cap API responses below the export batch size to catch truncation.
  const limit = Math.min(100, Number(url.searchParams.get("limit") || 100));
  rows = rows.slice(offset, offset + limit);
  res.writeHead(200, {
    "Content-Type": "application/json",
    "Content-Range": `${offset}-${offset + rows.length - 1}/${count}`,
  });
  res.end(JSON.stringify(rows));
});
fixture.listen(4398, "127.0.0.1", () => {
  const server = spawn(
    process.execPath,
    [
      "node_modules/next/dist/bin/next",
      "start",
      "-p",
      "4397",
      "-H",
      "127.0.0.1",
    ],
    {
      stdio: "inherit",
      env: {
        ...process.env,
        EMOTIONARY_LOCAL_PREVIEW: "true",
        SUPABASE_URL: "http://127.0.0.1:4398",
        SUPABASE_SERVICE_ROLE_KEY: "local-fixture-only",
        ADMIN_PASSWORD: "local-test-password",
        ADMIN_SESSION_SECRET: "local-tests-only-never-use-in-production",
      },
    },
  );
  const stop = () => {
    server.kill("SIGTERM");
    fixture.close();
  };
  process.on("SIGTERM", stop);
  process.on("SIGINT", stop);
  server.on("exit", (code) => {
    fixture.close();
    process.exitCode = code || 0;
  });
});

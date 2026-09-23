import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";

test("schema enforces normalized unique emails, original dates, consent, and private access", async () => {
  const db = new PGlite();
  try {
    await db.exec(
      "create role anon; create role authenticated; create role service_role bypassrls;",
    );
    await db.exec(
      await readFile(
        new URL(
          "../supabase/migrations/20260923185742_book_waitlist.sql",
          import.meta.url,
        ),
        "utf8",
      ),
    );
    const { rows: protection } = await db.query(
      `select relrowsecurity from pg_class where oid = 'public.book_waitlist'::regclass`,
    );
    assert.equal(protection[0].relrowsecurity, true);
    for (const role of ["anon", "authenticated"]) {
      await db.exec(`set role ${role}`);
      await assert.rejects(
        db.query("select * from public.book_waitlist"),
        /permission denied/,
      );
      await assert.rejects(
        db.query(
          "insert into public.book_waitlist (email, consent_version) values ('bad@example.com','launch-v1')",
        ),
        /permission denied/,
      );
      await db.exec("reset role");
    }
    await db.exec("set role service_role");
    const { rows } = await db.query(
      "insert into public.book_waitlist (email, consent_version) values ('reader@example.com','launch-v1') returning *",
    );
    assert.equal(rows[0].status, "active");
    assert.ok(rows[0].created_at);
    await assert.rejects(
      db.query(
        "insert into public.book_waitlist (email, consent_version) values ('reader@example.com','launch-v1')",
      ),
      /unique/,
    );
    await assert.rejects(
      db.query(
        "insert into public.book_waitlist (email, consent_version) values ('Reader@example.com','launch-v1')",
      ),
      /check constraint/,
    );
    await assert.rejects(
      db.query(
        "insert into public.book_waitlist (email, consent_version) values ('invalid','launch-v1')",
      ),
      /check constraint/,
    );
    await assert.rejects(
      db.query(
        "insert into public.book_waitlist (email) values ('new@example.com')",
      ),
      /not-null/,
    );
    await db.query(
      "update public.book_waitlist set status='unsubscribed', unsubscribed_at=now() where email='reader@example.com'",
    );
    await db.query(
      "insert into public.book_waitlist (email, consent_version) values ('reader@example.com','launch-v2') on conflict (email) do nothing",
    );
    const { rows: after } = await db.query(
      "select * from public.book_waitlist",
    );
    assert.equal(after.length, 1);
    assert.equal(after[0].status, "unsubscribed");
    assert.equal(String(after[0].created_at), String(rows[0].created_at));
    await assert.rejects(
      db.query("delete from public.book_waitlist"),
      /permission denied/,
    );
  } finally {
    await db.close();
  }
});

test("public signup RPC is private, rate-limited, and preserves duplicate/unsubscribed data", async () => {
  const db = new PGlite();
  try {
    await db.exec("create role anon; create role authenticated; create role service_role bypassrls;");
    for (const file of ["20260923185742_book_waitlist.sql", "20260923191049_book_waitlist_signup.sql"])
      await db.exec(await readFile(new URL(`../supabase/migrations/${file}`, import.meta.url), "utf8"));
    const hash = "a".repeat(64);
    for (const role of ["anon", "authenticated"]) {
      await db.exec(`set role ${role}`);
      await assert.rejects(db.query("select public.submit_book_waitlist($1, $2)", ["reader@example.com", hash]), /permission denied/);
      await assert.rejects(db.query("select * from public.book_waitlist_rate_limits"), /permission denied/);
      await db.exec("reset role");
    }
    await db.exec("set role service_role");
    await db.query("select public.submit_book_waitlist($1, $2)", ["Reader@Example.com", hash]);
    await db.query("update public.book_waitlist set status='unsubscribed', unsubscribed_at=now() where email='reader@example.com'");
    const original = (await db.query("select * from public.book_waitlist")).rows[0];
    for (let n=0;n<9;n++) assert.equal((await db.query("select public.submit_book_waitlist($1, $2) as accepted", ["reader@example.com", hash])).rows[0].accepted, true);
    assert.equal((await db.query("select public.submit_book_waitlist($1, $2) as accepted", ["blocked@example.com", hash])).rows[0].accepted, false);
    const rows=(await db.query("select * from public.book_waitlist")).rows;
    assert.equal(rows.length,1);
    assert.equal(rows[0].status,"unsubscribed");
    assert.equal(String(rows[0].created_at),String(original.created_at));
    await db.query("select public.submit_book_waitlist($1, $2)", ["other@example.com", "b".repeat(64)]);
    assert.equal((await db.query("select count(*)::int as n from public.book_waitlist")).rows[0].n, 2);
    await db.query("update public.book_waitlist_rate_limits set hits=1000 where bucket like 'global:%'");
    assert.equal((await db.query("select public.submit_book_waitlist($1, $2) as accepted", ["global-blocked@example.com", "c".repeat(64)])).rows[0].accepted,false);
  } finally { await db.close(); }
});

"use client";
import { useState } from "react";
import { Copy, Download, RefreshCcw } from "lucide-react";
import { useRouter } from "next/navigation";

export function WaitlistActions({
  query,
  disabled,
}: {
  query: string;
  disabled: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [fallback, setFallback] = useState("");
  const base = `/api/waitlist/export?${query}`;
  async function copy() {
    setBusy(true);
    setNotice("");
    setFallback("");
    try {
      const response = await fetch(`${base}&format=emails`, {
        cache: "no-store",
      });
      if (!response.ok)
        throw new Error(
          response.status === 401
            ? "Your session expired. Sign in again."
            : "Could not load all emails. Please try again.",
        );
      const { emails } = (await response.json()) as { emails: string[] };
      const text = emails.join("\n");
      if (!emails.length) {
        setNotice("No matching emails to copy.");
        return;
      }
      try {
        await navigator.clipboard.writeText(text);
        setNotice(`Copied ${emails.length.toLocaleString()} email addresses.`);
      } catch {
        setFallback(text);
        setNotice(
          "Clipboard access is unavailable. Select and copy the email addresses below.",
        );
      }
    } catch (error) {
      setNotice(
        error instanceof Error ? error.message : "Could not copy the emails.",
      );
    } finally {
      setBusy(false);
    }
  }
  const button =
    "inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50";
  return (
    <div>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={copy}
          disabled={disabled || busy}
          className={button}
        >
          <Copy size={16} aria-hidden="true" />
          {busy ? "Loading all emails…" : "Copy all matching emails"}
        </button>
        {disabled ? (
          <button disabled className={button}>
            <Download size={16} aria-hidden="true" />
            Export CSV
          </button>
        ) : (
          <a className={button} href={`${base}&format=csv`}>
            <Download size={16} aria-hidden="true" />
            Export CSV
          </a>
        )}
        <button
          type="button"
          className={button}
          onClick={() => {
            setFallback("");
            setNotice("");
            router.refresh();
          }}
        >
          <RefreshCcw size={16} aria-hidden="true" />
          Refresh
        </button>
      </div>
      <p role="status" className="mt-3 text-sm text-slate-700">
        {notice}
      </p>
      {fallback && (
        <label className="mt-3 block text-sm font-medium text-slate-700">
          Email addresses
          <textarea
            aria-label="Email addresses to copy"
            readOnly
            value={fallback}
            onFocus={(event) => event.target.select()}
            rows={6}
            className="mt-2 w-full rounded-lg border border-slate-300 p-3 font-mono text-sm"
          />
        </label>
      )}
    </div>
  );
}

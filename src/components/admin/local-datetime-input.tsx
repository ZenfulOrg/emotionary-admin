"use client";

import { useState } from "react";

/**
 * A date and time in your own time zone, submitted as an exact moment
 * (ISO with offset) so the server never guesses the zone.
 */
export function LocalDateTimeInput({ name, className }: { name: string; className?: string }) {
  const [iso, setIso] = useState("");
  return (
    <>
      <input
        type="datetime-local"
        className={className}
        aria-label="Send at"
        onChange={(event) => {
          const value = event.target.value;
          const date = value ? new Date(value) : null;
          setIso(date && !Number.isNaN(date.getTime()) ? date.toISOString() : "");
        }}
      />
      <input type="hidden" name={name} value={iso} />
    </>
  );
}

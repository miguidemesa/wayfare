"use client";

import { useEffect, useState } from "react";

/** Live local time for a city (client-only to avoid hydration mismatch). */
export function LocalTimeWidget({
  timeZone,
  label,
  className,
}: {
  timeZone: string;
  label?: string;
  className?: string;
}) {
  const [time, setTime] = useState<string | null>(null);

  useEffect(() => {
    const tick = () => {
      try {
        setTime(
          new Intl.DateTimeFormat("en-US", {
            hour: "2-digit",
            minute: "2-digit",
            hour12: false,
            timeZone,
          }).format(new Date())
        );
      } catch {
        setTime(null);
      }
    };
    tick();
    const id = setInterval(tick, 30_000);
    return () => clearInterval(id);
  }, [timeZone]);

  return (
    <span className={className}>
      {label ? <span className="mr-1 text-ink-3">{label}</span> : null}
      <span className="tabular font-semibold">{time ?? "--:--"}</span>
    </span>
  );
}

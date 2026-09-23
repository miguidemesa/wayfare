"use client";

// Cinematic destination hero — editorial typography over the live 3D
// environment, with countdown, local time, weather and planning progress.
// Designed to feel like a travel publication cover, not a dashboard header.

import { motion } from "framer-motion";
import { CalendarRange, ChevronDown, MapPin, Users } from "lucide-react";
import type { DestinationTheme } from "@/lib/destination-themes";
import { hexA } from "@/lib/destination-themes";
import { LocalTimeWidget } from "@/components/local-time";
import { SceneBackdrop } from "@/components/three/scene-loader";

const ease = [0.16, 1, 0.3, 1] as const;

export function DestinationHero({
  theme,
  title,
  country,
  city,
  dateFmt,
  daysUntil,
  isBefore,
  isAfter,
  statusLabel,
  dayCount,
  travelers,
  tripProgress,
  timeZone,
  onOpenSettings,
}: {
  theme: DestinationTheme;
  title: string;
  country: string;
  city: string;
  dateFmt: string;
  daysUntil: number;
  isBefore: boolean;
  isAfter: boolean;
  statusLabel: string;
  dayCount: number;
  travelers: number;
  tripProgress: number;
  timeZone: string;
  onOpenSettings: () => void;
}) {
  const place = city || country;

  return (
    <motion.section
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.6, ease }}
      className="relative -mx-4 -mt-5 overflow-hidden text-white sm:-mx-6"
      aria-label={`${place} trip overview`}
    >
      <SceneBackdrop theme={theme} />

      {/* legibility scrim */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: `linear-gradient(to top, ${hexA(theme.deep, 0.92)} 0%, ${hexA(theme.deep, 0.55)} 45%, ${hexA(theme.deep, 0.25)} 100%)`,
        }}
      />

      <div className="relative z-10 flex min-h-[480px] flex-col justify-end px-6 pb-8 pt-24 sm:min-h-[540px] sm:px-10">
        {/* status row */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15, duration: 0.5, ease }}
          className="flex flex-wrap items-center gap-2 text-[11px]"
        >
          <span className="rounded-full border border-white/25 bg-white/10 px-2.5 py-1 font-semibold uppercase tracking-widest backdrop-blur">
            {statusLabel}
          </span>
          <span className="rounded-full border border-white/15 bg-white/5 px-2.5 py-1 backdrop-blur">
            {theme.motifs.slice(0, 2).join(" · ")}
          </span>
          <LocalTimeWidget
            timeZone={timeZone}
            label={place ? `${place},` : undefined}
            className="ml-auto rounded-full border border-white/20 bg-white/10 px-2.5 py-1 text-[11px] text-white backdrop-blur [&_.text-ink-3]:text-white/60"
          />
          <button
            onClick={onOpenSettings}
            className="cursor-pointer rounded-full border border-white/20 bg-white/10 px-2.5 py-1 font-medium backdrop-blur transition-colors hover:bg-white/20"
            aria-label="Trip settings"
          >
            Settings
          </button>
        </motion.div>

        {/* editorial masthead */}
        <motion.h1
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25, duration: 0.7, ease }}
          className="mt-6 font-display leading-[0.95] tracking-tight drop-shadow-sm"
        >
          <span className="block text-[clamp(3rem,9vw,6.5rem)] uppercase">{title}</span>
          {country ? (
            <span className="mt-2 block font-display text-[clamp(1.1rem,2.4vw,1.6rem)] italic text-white/70">
              {country}
            </span>
          ) : null}
        </motion.h1>

        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.45, duration: 0.6 }}
          className="mt-3 max-w-md text-sm italic leading-relaxed text-white/65"
        >
          {theme.tagline}
        </motion.p>

        {/* metadata band */}
        <motion.div
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5, duration: 0.6, ease }}
          className="mt-8 flex flex-wrap items-end justify-between gap-x-8 gap-y-5"
        >
          <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm text-white/80">
            <span className="flex items-center gap-2">
              <CalendarRange size={14} className="text-white/50" />
              {dateFmt}
            </span>
            <span className="flex items-center gap-2">
              <MapPin size={14} className="text-white/50" />
              {dayCount} days
            </span>
            {travelers > 1 ? (
              <span className="flex items-center gap-2">
                <Users size={14} className="text-white/50" />
                {travelers} travelers
              </span>
            ) : null}
          </div>

          <div className="flex items-end gap-8">
            <div>
              <p className="text-[10px] font-semibold text-white/50">
                {isBefore ? "Departs in" : isAfter ? "Completed" : "Happening now"}
              </p>
              <p className="tabular mt-1 text-3xl font-semibold tracking-tight">
                {isBefore ? `${daysUntil}` : isAfter ? "✓" : "●"}
                {isBefore ? <span className="ml-1 text-sm font-normal text-white/60">days</span> : null}
              </p>
            </div>
            <div className="w-40">
              <div className="flex items-baseline justify-between text-[10px] font-semibold text-white/50">
                <span>Planned</span>
                <span className="tabular">{tripProgress}%</span>
              </div>
              <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-white/15">
                <motion.div
                  className="h-full rounded-full"
                  style={{ background: `linear-gradient(90deg, ${theme.accent}, ${theme.glowA})` }}
                  initial={{ width: 0 }}
                  animate={{ width: `${tripProgress}%` }}
                  transition={{ delay: 0.7, duration: 1, ease }}
                />
              </div>
            </div>
          </div>
        </motion.div>

        {/* explore affordance */}
        <motion.a
          href="#trip-overview"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.9 }}
          className="group mt-8 inline-flex w-fit items-center gap-2 rounded-full border border-white/25 bg-white/10 px-4 py-2 text-xs font-semibold uppercase tracking-widest backdrop-blur transition-colors hover:bg-white/20"
        >
          Explore trip
          <ChevronDown size={14} className="transition-transform group-hover:translate-y-0.5" />
        </motion.a>
      </div>
    </motion.section>
  );
}
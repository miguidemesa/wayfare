"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import {
  Bell,
  BookOpen,
  CalendarRange,
  ChevronLeft,
  CloudOff,
  Compass,
  CreditCard,
  FileText,
  Home,
  LayoutDashboard,
  MapPin,
  Moon,
  PackageCheck,
  Plane,
  RefreshCw,
  Search,
  Sparkles,
  Sun,
  Ticket,
} from "lucide-react";
import { useTheme } from "next-themes";
import { cn } from "@/lib/utils";
import { useOnline } from "@/lib/use-online";
import type { TripNotification } from "@/lib/notifications";
import { CommandPalette } from "./command-palette";
import { Badge } from "./ui";

export type ShellTrip = {
  id: string;
  title: string;
  subtitle: string | null;
  coverEmoji: string;
  homeCurrency: string;
};

const NAV_GROUPS = [
  {
    title: "Plan",
    items: [
      { href: "", label: "Overview", icon: LayoutDashboard },
      { href: "/itinerary", label: "Itinerary", icon: CalendarRange },
      { href: "/map", label: "Map", icon: MapPin },
      { href: "/discover", label: "Discover", icon: Compass },
    ],
  },
  {
    title: "On Trip",
    items: [
      { href: "/hotels", label: "Stays & Flights", icon: Plane },
      { href: "/reservations", label: "Reservations", icon: Ticket },
      { href: "/packing", label: "Packing", icon: PackageCheck },
    ],
  },
  {
    title: "Money & Vault",
    items: [
      { href: "/expenses", label: "Expenses", icon: CreditCard },
      { href: "/currency", label: "Currency", icon: RefreshCw },
      { href: "/documents", label: "Documents", icon: FileText },
    ],
  },
  {
    title: "Memory",
    items: [
      { href: "/journal", label: "Journal", icon: BookOpen },
      { href: "/wrapped", label: "Trip Wrapped", icon: Sparkles },
    ],
  },
];

import { AccountSettingsModal } from "@/components/account-settings-modal";

export function AppShell({
  trip,
  user,
  notifications,
  children,
}: {
  trip: ShellTrip;
  user: { name: string };
  notifications: TripNotification[];
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const base = `/t/${trip.id}`;
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [bellOpen, setBellOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const online = useOnline();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setPaletteOpen(true);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const isAi = pathname === `${base}/ai`;
  const unread = notifications.length;

  return (
    <div className="flex min-h-dvh">
      {/* ------------------------------------------------ desktop sidebar */}
      <aside className="sticky top-0 hidden h-dvh w-[236px] shrink-0 flex-col border-r border-line bg-surface lg:flex">
        <div className="flex items-center gap-2.5 px-5 pt-5 pb-4">
          <Link href="/" className="flex items-center gap-2.5 group">
            <span className="grid h-8 w-8 place-items-center rounded-xl bg-gradient-to-br from-accent to-accent-strong text-white shadow-2xs transition-transform group-hover:scale-105">
              <Compass size={17} strokeWidth={2.3} />
            </span>
            <span className="font-display text-lg font-normal tracking-tight">Wayfare</span>
          </Link>
          <span className="ml-auto rounded-md bg-surface-2 px-1.5 py-0.5 text-[9.5px] font-bold uppercase tracking-wider text-ink-3 border border-line">
            PRO
          </span>
        </div>

        <div className="mx-3 mb-3 flex items-center gap-2.5 rounded-xl border border-line bg-surface-2/50 p-2.5 shadow-2xs">
          <span className="grid h-8 w-8 place-items-center rounded-lg bg-surface border border-line text-sm shrink-0 shadow-2xs">
            {trip.coverEmoji}
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-[13px] font-semibold leading-tight text-ink">{trip.title}</p>
            <p className="truncate text-[11px] text-ink-3 font-mono">{trip.subtitle || "Portfolio"}</p>
          </div>
          <Link
            href="/"
            aria-label="All trips"
            className="rounded-lg p-1.5 text-ink-3 hover:bg-surface hover:text-ink transition-colors"
          >
            <ChevronLeft size={15} />
          </Link>
        </div>

        <nav className="flex-1 overflow-y-auto px-3 pb-4 space-y-4 hide-scrollbar" aria-label="Trip sections">
          {NAV_GROUPS.map((group) => (
            <div key={group.title} className="space-y-1">
              <p className="px-2.5 text-[10px] font-bold uppercase tracking-widest text-ink-3/90">
                {group.title}
              </p>
              <div className="space-y-0.5">
                {group.items.map(({ href, label, icon: Icon }) => {
                  const active = pathname === `${base}${href}`;
                  return (
                    <Link
                      key={label}
                      href={`${base}${href}`}
                      aria-current={active ? "page" : undefined}
                      className={cn(
                        "flex items-center gap-2.5 rounded-xl px-2.5 py-1.5 text-[13px] font-medium transition-all",
                        active
                          ? "bg-accent/10 text-accent font-semibold border border-accent/20 shadow-2xs"
                          : "text-ink-2 hover:text-ink hover:bg-surface-2 border border-transparent"
                      )}
                    >
                      <Icon size={15} strokeWidth={active ? 2.2 : 1.8} />
                      {label}
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        <div className="p-3 border-t border-line/60">
          <Link
            href={`${base}/ai`}
            className={cn(
              "flex items-center gap-2.5 rounded-xl px-3 py-2 text-[13px] font-semibold transition-all",
              isAi
                ? "bg-gradient-to-b from-accent to-accent-strong text-white shadow-xs border border-accent-strong/40"
                : "border border-line bg-surface hover:border-accent/40 hover:bg-accent/5 text-ink"
            )}
          >
            <Sparkles size={15} className={isAi ? "" : "text-accent"} />
            Concierge
            <kbd className="ml-auto rounded border border-current/20 px-1 text-[9px] opacity-70 font-mono">⌘J</kbd>
          </Link>
        </div>
      </aside>

      {/* ------------------------------------------------------ main area */}
      <div className="flex min-w-0 flex-1 flex-col">
        {/* topbar */}
        <header className="glass sticky top-0 z-50 flex h-14 items-center gap-2 border-b border-line px-4 sm:px-6">
          <Link href="/" className="lg:hidden grid h-8 w-8 place-items-center rounded-lg bg-gradient-to-br from-accent to-sky text-white">
            <Compass size={16} />
          </Link>

          <button
            onClick={() => setPaletteOpen(true)}
            className="group flex h-9 min-w-0 max-w-md flex-1 items-center gap-2 rounded-[10px] border border-line bg-surface px-3 text-left text-[13px] text-ink-3 transition-colors hover:border-line-strong sm:flex-none sm:w-64"
          >
            <Search size={14} />
            <span className="truncate">Search trip…</span>
            <kbd className="ml-auto hidden rounded border border-line bg-surface-2 px-1.5 py-0.5 text-[10px] sm:block">
              ⌘K
            </kbd>
          </button>

          <div className="ml-auto flex items-center gap-1">
            {!online.online || online.pending > 0 ? (
              <Badge tone={online.online ? "warning" : "neutral"} className="mr-1 gap-1.5 py-1">
                <CloudOff size={12} />
                {online.online
                  ? `Syncing ${online.pending}`
                  : online.lastSync
                    ? `Offline · ${formatAgo(online.lastSync)}`
                    : "Offline"}
              </Badge>
            ) : null}

            <NotificationCenter
              open={bellOpen}
              setOpen={setBellOpen}
              notifications={notifications}
            />

            <ThemeToggle />

            <button
              onClick={() => setAccountOpen(true)}
              title={`${user.name} (Account Settings)`}
              className="grid h-8 w-8 place-items-center rounded-full bg-gradient-to-br from-coral to-violet text-[11px] font-bold text-white transition-transform hover:scale-105 cursor-pointer shadow-xs"
            >
              {user.name.slice(0, 2).toUpperCase()}
            </button>
          </div>
        </header>

        <main className="flex-1 pb-20 lg:pb-0">{children}</main>
      </div>

      {/* ------------------------------------------------ mobile bottom nav */}
      <nav
        className="glass fixed inset-x-0 bottom-0 z-50 flex h-16 items-stretch justify-around border-t border-line lg:hidden"
        aria-label="Primary"
      >
        {[
          { href: "/", label: "Home", icon: Home },
          { href: `${base}/itinerary`, label: "Trip", icon: CalendarRange },
          { href: `${base}/map`, label: "Map", icon: MapPin },
          { href: `${base}/expenses`, label: "Money", icon: CreditCard },
          { href: `${base}/ai`, label: "AI", icon: Sparkles, accent: true },
        ].map(({ href, label, icon: Icon, accent }) => {
          const active =
            href === "/" ? pathname === "/" : pathname.startsWith(href);
          return (
            <Link
              key={label}
              href={href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "flex flex-col items-center justify-center gap-0.5 px-3 text-[10px] font-medium transition-colors",
                active ? (accent ? "text-accent" : "text-ink") : "text-ink-3"
              )}
            >
              <Icon size={20} strokeWidth={active ? 2.4 : 2} />
              {label}
            </Link>
          );
        })}
      </nav>

      <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} tripId={trip.id} tripBase={base} />

      <AccountSettingsModal
        open={accountOpen}
        onClose={() => setAccountOpen(false)}
        user={user}
      />
    </div>
  );
}

function formatAgo(ts: number): string {
  const mins = Math.max(1, Math.round((Date.now() - ts) / 60000));
  if (mins < 60) return `${mins}m ago`;
  return `${Math.round(mins / 60)}h ago`;
}

function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted) return <span className="h-9 w-9" />;
  const dark = resolvedTheme === "dark";
  return (
    <button
      onClick={() => setTheme(dark ? "light" : "dark")}
      aria-label={dark ? "Switch to light theme" : "Switch to dark theme"}
      className="grid h-9 w-9 place-items-center rounded-[10px] text-ink-2 transition-colors hover:bg-surface-2 hover:text-ink"
    >
      {dark ? <Sun size={16} /> : <Moon size={16} />}
    </button>
  );
}

function NotificationCenter({
  open,
  setOpen,
  notifications,
}: {
  open: boolean;
  setOpen: (v: boolean) => void;
  notifications: TripNotification[];
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [open, setOpen]);

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(!open)}
        aria-label={`Notifications (${notifications.length})`}
        aria-expanded={open}
        className="relative grid h-9 w-9 place-items-center rounded-[10px] text-ink-2 transition-colors hover:bg-surface-2 hover:text-ink"
      >
        <Bell size={16} />
        {notifications.length > 0 && (
          <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-coral ring-2 ring-bg animate-pulse" style={{ animationDuration: "3s" }} />
        )}
      </button>

      {open ? (
        <div className="card absolute right-0 top-11 z-[70] w-80 overflow-hidden animate-scale-in shadow-pop">
          <div className="border-b border-line px-4 py-2.5 text-[13px] font-semibold">
            Notifications
          </div>
          {notifications.length === 0 ? (
            <p className="px-4 py-6 text-center text-[13px] text-ink-3">
              All clear — nothing needs your attention 🎉
            </p>
          ) : (
            <ul className="max-h-96 divide-y divide-line overflow-y-auto">
              {notifications.map((n) => (
                <li key={n.id} className="flex gap-3 px-4 py-3">
                  <span className="text-base leading-none mt-0.5">{n.icon}</span>
                  <div className="min-w-0">
                    <p className="text-[13px] font-medium leading-snug">{n.title}</p>
                    <p className="mt-0.5 text-xs text-ink-3 leading-snug">{n.body}</p>
                  </div>
                  <Badge
                    tone={n.tone === "info" ? "info" : n.tone === "warning" ? "warning" : n.tone === "danger" ? "danger" : "success"}
                    className="ml-auto self-start shrink-0"
                  >
                    {n.tone === "success" ? "ready" : n.tone === "danger" ? "urgent" : n.tone}
                  </Badge>
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : null}
    </div>
  );
}

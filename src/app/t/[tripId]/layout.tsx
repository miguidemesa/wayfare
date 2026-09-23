import { notFound, redirect } from "next/navigation";
import { getAuthUser } from "@/lib/auth";
import { getTripBundle } from "@/lib/trip-service";
import { computeNotifications } from "@/lib/notifications";
import { AppShell } from "@/components/app-shell";
import { DestinationThemeScope } from "@/components/destination-theme-scope";
import { resolveDestinationTheme } from "@/lib/destination-themes";
import { LocalTimeWidget } from "@/components/local-time";
import { MapPin } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function TripLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ tripId: string }>;
}) {
  const user = await getAuthUser();
  if (!user) redirect("/login");
  const { tripId } = await params;

  let bundle;
  try {
    bundle = await getTripBundle(tripId, user.id);
  } catch {
    notFound();
  }

  const notifications = computeNotifications(bundle);
  const theme = resolveDestinationTheme(bundle.destinations, bundle.trip.coverTheme);
  const activeCity = bundle.destinations[0]?.name ?? "";

  return (
    <AppShell
      trip={{
        id: bundle.trip.id,
        title: bundle.trip.title,
        subtitle: bundle.trip.subtitle,
        coverEmoji: bundle.trip.coverEmoji,
        homeCurrency: bundle.trip.homeCurrency,
      }}
      user={{ name: user.name }}
      notifications={notifications}
    >
      <DestinationThemeScope theme={theme}>
        {/* destination ribbon — keeps every sub-page anchored to its world */}
        <div
          className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-line bg-surface-2/40 px-4 py-2 text-[11px] sm:px-6"
          style={{ backgroundImage: `linear-gradient(90deg, color-mix(in srgb, ${theme.accent} 7%, transparent), transparent 60%)` }}
        >
          <span className="flex items-center gap-1.5 font-semibold uppercase tracking-widest text-ink-2">
            <MapPin size={11} className="shrink-0" style={{ color: theme.accent }} />
            {bundle.trip.title}
            {activeCity ? <span className="font-normal normal-case tracking-normal text-ink-3">· {activeCity}</span> : null}
          </span>
          <span className="hidden items-center gap-1.5 text-ink-3 sm:flex">
            {theme.motifs.slice(0, 3).map((m) => (
              <span key={m} className="rounded-full border border-line bg-surface px-2 py-0.5">
                {m}
              </span>
            ))}
          </span>
          <LocalTimeWidget
            timeZone={activeCity ? (TZ_BY_CITY[activeCity] ?? "UTC") : "UTC"}
            label={activeCity ? `${activeCity},` : undefined}
            className="ml-auto rounded-full border border-line bg-surface px-2.5 py-0.5 text-[11px]"
          />
        </div>
        {children}
      </DestinationThemeScope>
    </AppShell>
  );
}

const TZ_BY_CITY: Record<string, string> = {
  Tokyo: "Asia/Tokyo",
  Kyoto: "Asia/Tokyo",
  Seoul: "Asia/Seoul",
  Rome: "Europe/Rome",
  Florence: "Europe/Rome",
  Venice: "Europe/Rome",
  Paris: "Europe/Paris",
  Manila: "Asia/Manila",
};

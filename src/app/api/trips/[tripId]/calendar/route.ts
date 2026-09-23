import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getAuthUser, HttpError } from "@/lib/auth";
import { handle } from "@/lib/api-helpers";

function formatIcsDate(d: Date): string {
  return d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
}

function formatIcsDayOnly(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}${m}${day}`;
}

function escapeIcsText(str: string): string {
  return str
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\r?\n/g, "\\n");
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ tripId: string }> }
) {
  return handle(async () => {
    const user = await getAuthUser();
    if (!user) throw new HttpError(401, "Not signed in");
    const { tripId } = await params;

    const trip = await db.trip.findFirst({
      where: { id: tripId, userId: user.id },
      include: {
        flights: { orderBy: { departAt: "asc" } },
        hotels: { orderBy: { checkIn: "asc" } },
        reservations: { orderBy: { dateTime: "asc" } },
        days: {
          orderBy: { date: "asc" },
          include: { items: { orderBy: [{ order: "asc" }, { startTime: "asc" }] } },
        },
      },
    });

    if (!trip) throw new HttpError(404, "Trip not found");

    const lines: string[] = [
      "BEGIN:VCALENDAR",
      "VERSION:2.0",
      "PRODID:-//Wayfare//Wayfare AI Travel OS//EN",
      "CALSCALE:GREGORIAN",
      "METHOD:PUBLISH",
      `X-WR-CALNAME:${escapeIcsText(trip.title)}`,
      `X-WR-CALDESC:${escapeIcsText(trip.subtitle || `Trip to ${trip.title}`)}`,
    ];

    const nowStr = formatIcsDate(new Date());

    // 1. Flights
    for (const f of trip.flights) {
      lines.push("BEGIN:VEVENT");
      lines.push(`UID:flight-${f.id}@wayfare.app`);
      lines.push(`DTSTAMP:${nowStr}`);
      lines.push(`DTSTART:${formatIcsDate(f.departAt)}`);
      lines.push(`DTEND:${formatIcsDate(f.arriveAt)}`);
      lines.push(`SUMMARY:${escapeIcsText(`âœˆï¸ ${f.airline} ${f.flightNumber}: ${f.originCode} â†’ ${f.destCode}`)}`);
      lines.push(
        `DESCRIPTION:${escapeIcsText(
          [
            `Flight: ${f.airline} ${f.flightNumber}`,
            `Route: ${f.originCity} (${f.originCode}) â†’ ${f.destCity} (${f.destCode})`,
            f.confirmation ? `Confirmation: ${f.confirmation}` : null,
            f.seat ? `Seat: ${f.seat}` : null,
            f.terminal ? `Terminal: ${f.terminal}` : null,
          ]
            .filter(Boolean)
            .join("\n")
        )}`
      );
      lines.push(`LOCATION:${escapeIcsText(`${f.originCity} Airport (${f.originCode})`)}`);
      lines.push("STATUS:CONFIRMED");
      lines.push("END:VEVENT");
    }

    // 2. Hotels
    for (const h of trip.hotels) {
      lines.push("BEGIN:VEVENT");
      lines.push(`UID:hotel-${h.id}@wayfare.app`);
      lines.push(`DTSTAMP:${nowStr}`);
      lines.push(`DTSTART;VALUE=DATE:${formatIcsDayOnly(h.checkIn)}`);
      lines.push(`DTEND;VALUE=DATE:${formatIcsDayOnly(h.checkOut)}`);
      lines.push(`SUMMARY:${escapeIcsText(`ðŸ¨ Stay: ${h.name}`)}`);
      lines.push(
        `DESCRIPTION:${escapeIcsText(
          [
            `Hotel: ${h.name}`,
            h.destinationName ? `Destination: ${h.destinationName}` : null,
            h.confirmationNumber ? `Confirmation: ${h.confirmationNumber}` : null,
            h.phone ? `Phone: ${h.phone}` : null,
            h.address ? `Address: ${h.address}` : null,
          ]
            .filter(Boolean)
            .join("\n")
        )}`
      );
      if (h.address) {
        lines.push(`LOCATION:${escapeIcsText(h.address)}`);
      }
      lines.push("STATUS:CONFIRMED");
      lines.push("END:VEVENT");
    }

    // 3. Reservations
    for (const r of trip.reservations) {
      const endTime = new Date(r.dateTime.getTime() + 90 * 60000); // default 90m
      lines.push("BEGIN:VEVENT");
      lines.push(`UID:reservation-${r.id}@wayfare.app`);
      lines.push(`DTSTAMP:${nowStr}`);
      lines.push(`DTSTART:${formatIcsDate(r.dateTime)}`);
      lines.push(`DTEND:${formatIcsDate(endTime)}`);
      lines.push(`SUMMARY:${escapeIcsText(`ðŸŽŸï¸ ${r.title}`)}`);
      lines.push(
        `DESCRIPTION:${escapeIcsText(
          [
            `Type: ${r.type}`,
            r.confirmationNumber ? `Confirmation: ${r.confirmationNumber}` : null,
            r.locationName ? `Location: ${r.locationName}` : null,
            r.notes ? `Notes: ${r.notes}` : null,
          ]
            .filter(Boolean)
            .join("\n")
        )}`
      );
      if (r.locationName || r.address) {
        lines.push(`LOCATION:${escapeIcsText(r.address || r.locationName || "")}`);
      }
      lines.push("STATUS:CONFIRMED");
      lines.push("END:VEVENT");
    }

    // 4. Scheduled Itinerary Items with specific start times
    for (const day of trip.days) {
      for (const item of day.items) {
        if (item.startTime != null) {
          const itemStart = new Date(day.date);
          itemStart.setHours(Math.floor(item.startTime / 60), item.startTime % 60, 0, 0);
          const duration = item.durationMin || 60;
          const itemEnd = new Date(itemStart.getTime() + duration * 60000);

          lines.push("BEGIN:VEVENT");
          lines.push(`UID:item-${item.id}@wayfare.app`);
          lines.push(`DTSTAMP:${nowStr}`);
          lines.push(`DTSTART:${formatIcsDate(itemStart)}`);
          lines.push(`DTEND:${formatIcsDate(itemEnd)}`);
          lines.push(`SUMMARY:${escapeIcsText(item.title)}`);
          if (item.notes || item.neighborhood) {
            lines.push(
              `DESCRIPTION:${escapeIcsText(
                [item.neighborhood ? `Neighborhood: ${item.neighborhood}` : null, item.notes]
                  .filter(Boolean)
                  .join("\n")
              )}`
            );
          }
          if (item.placeName) {
            lines.push(`LOCATION:${escapeIcsText(item.placeName)}`);
          }
          lines.push("STATUS:CONFIRMED");
          lines.push("END:VEVENT");
        }
      }
    }

    lines.push("END:VCALENDAR");

    const icsContent = lines.join("\r\n");
    const safeFilename = trip.title.toLowerCase().replace(/[^a-z0-9_-]/g, "_");

    return new NextResponse(icsContent, {
      status: 200,
      headers: {
        "Content-Type": "text/calendar; charset=utf-8",
        "Content-Disposition": `attachment; filename="${safeFilename || "trip"}.ics"`,
        "Cache-Control": "no-cache, no-store",
      },
    });
  });
}

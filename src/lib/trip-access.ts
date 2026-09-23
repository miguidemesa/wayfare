import "server-only";
import { db } from "./db";
import { HttpError } from "./auth";

/**
 * Shared trip authorization.
 *
 * A trip is accessible when the user owns it OR is listed as a traveler on it
 * (matched by account email — same rule as requireTrip in trip-service).
 * Write access is currently co-extensive with read access: invited travelers
 * are collaborators, not spectators. This helper is the single source of truth
 * for that policy; every trip-scoped mutation route must go through it.
 */

export async function canAccessTrip(tripId: string, userId: string): Promise<boolean> {
  const user = await db.user.findUnique({ where: { id: userId }, select: { email: true } });
  const trip = await db.trip.findFirst({
    where: {
      id: tripId,
      OR: [
        { userId },
        ...(user?.email ? [{ travelers: { some: { email: user.email } } }] : []),
      ],
    },
    select: { id: true },
  });
  return trip !== null;
}

/** Throws 404 (not 403 — avoids leaking trip existence) when access is denied. */
export async function requireTripAccess(tripId: string, userId: string) {
  const allowed = await canAccessTrip(tripId, userId);
  if (!allowed) throw new HttpError(404, "Trip not found");
}

/**
 * Resolve the trip row when access is granted. Returns the full trip so
 * routes can use fields (homeCurrency, dates) without a second query.
 */
export async function requireTrip(tripId: string, userId: string) {
  const user = await db.user.findUnique({ where: { id: userId }, select: { email: true } });
  const trip = await db.trip.findFirst({
    where: {
      id: tripId,
      OR: [
        { userId },
        ...(user?.email ? [{ travelers: { some: { email: user.email } } }] : []),
      ],
    },
  });
  if (!trip) throw new HttpError(404, "Trip not found");
  return trip;
}

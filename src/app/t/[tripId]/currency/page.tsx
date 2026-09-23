import { getAuthUser } from "@/lib/auth";
import { getRates } from "@/lib/currency";
import { db } from "@/lib/db";
import { notFound } from "next/navigation";
import { CurrencyClient } from "./currency-client";

export const dynamic = "force-dynamic";

export default async function CurrencyPage({
  params,
}: {
  params: Promise<{ tripId: string }>;
}) {
  const user = await getAuthUser();
  if (!user) return null;
  const { tripId } = await params;
  const trip = await db.trip.findFirst({ where: { id: tripId, userId: user.id } });
  if (!trip) notFound();

  const ratesInfo = await getRates();

  return (
    <CurrencyClient
      tripId={trip.id}
      homeCurrency={trip.homeCurrency}
      rates={ratesInfo.rates}
      updatedAt={ratesInfo.updatedAt.toISOString()}
      source={ratesInfo.source}
    />
  );
}

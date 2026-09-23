import { getAuthUser } from "@/lib/auth";
import { getTripBundle } from "@/lib/trip-service";
import { getRates } from "@/lib/currency";
import { notFound } from "next/navigation";
import { ExpensesClient } from "./expenses-client";

export const dynamic = "force-dynamic";

export default async function ExpensesPage({
  params,
}: {
  params: Promise<{ tripId: string }>;
}) {
  const user = await getAuthUser();
  if (!user) return null;
  const { tripId } = await params;

  let bundle;
  let rates;
  try {
    [bundle, rates] = await Promise.all([
      getTripBundle(tripId, user.id),
      getRates(),
    ]);
  } catch {
    notFound();
  }

  return (
    <ExpensesClient
      bundle={bundle}
      rates={rates.rates}
      ratesUpdatedAt={rates.updatedAt.toISOString()}
      ratesSource={rates.source}
    />
  );
}

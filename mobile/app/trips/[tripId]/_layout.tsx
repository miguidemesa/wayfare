import { Stack, useLocalSearchParams } from "expo-router";
import { TripProvider } from "@/lib/trip";
import { modalOptions } from "@/lib/nav";
import { useTheme } from "@/shared/theme";

export { ErrorFallback as ErrorBoundary } from "@/components/ErrorFallback";

// Opening a stop (or any trip screen) directly — from Home or a link — still
// puts the trip's tabs underneath, so Back lands on the plan, not outside it.
export const unstable_settings = { initialRouteName: "(tabs)" };

// Everything inside a trip shares one TripProvider, so the three tabs and every
// screen pushed over them read the same bundle. Tabs stay mounted underneath
// pushed screens — returning from a stop lands on the same day and scroll.
export default function TripLayout() {
  const { tripId } = useLocalSearchParams<{ tripId: string }>();
  const { colors } = useTheme();

  return (
    <TripProvider tripId={tripId}>
      <Stack screenOptions={{ headerShown: false, animation: "default", contentStyle: { backgroundColor: colors.paper } }}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="stop/[itemId]" />
        <Stack.Screen name="details" />
        <Stack.Screen name="bookings" />
        <Stack.Screen name="documents" />
        <Stack.Screen name="packing" />
        <Stack.Screen name="journal" />
        <Stack.Screen name="currency" />
        <Stack.Screen name="places" />
        <Stack.Screen name="recap" />
        <Stack.Screen name="add-stop" options={modalOptions} />
        <Stack.Screen name="add-expense" options={modalOptions} />
        <Stack.Screen name="suggest" options={modalOptions} />
        <Stack.Screen name="ask" options={modalOptions} />
      </Stack>
    </TripProvider>
  );
}

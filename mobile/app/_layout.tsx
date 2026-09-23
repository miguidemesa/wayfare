import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { AuthProvider } from "@/lib/auth";
import { TRAVEL_THEME } from "@/shared/theme";
import { ErrorFallback } from "@/components/ErrorFallback";

// expo-router renders this in place of any screen below the root layout
// that throws during render — the last line of defense app-wide.
export { ErrorFallback as ErrorBoundary };

export default function RootLayout() {
  return (
    <AuthProvider>
      <StatusBar style="dark" />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: TRAVEL_THEME.colors.bg },
          animation: "slide_from_right",
        }}
      >
        <Stack.Screen name="index" />
        <Stack.Screen name="login" />
        <Stack.Screen name="trips/index" />
        <Stack.Screen name="trips/new" options={{ presentation: "modal" }} />
        <Stack.Screen name="trips/[tripId]/index" />
        <Stack.Screen name="trips/[tripId]/itinerary" />
        <Stack.Screen name="trips/[tripId]/expenses" />
        <Stack.Screen name="trips/[tripId]/ai" />
        <Stack.Screen name="trips/[tripId]/packing" />
        <Stack.Screen name="trips/[tripId]/documents" />
        <Stack.Screen name="trips/[tripId]/reservations" />
        <Stack.Screen name="trips/[tripId]/discover" />
        <Stack.Screen name="trips/[tripId]/currency" />
        <Stack.Screen name="trips/[tripId]/journal" />
        <Stack.Screen name="trips/[tripId]/wrapped" />
      </Stack>
    </AuthProvider>
  );
}
import { useEffect } from "react";
import { View } from "react-native";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import * as SplashScreen from "expo-splash-screen";
import { useFonts } from "expo-font";
import {
  Newsreader_400Regular,
  Newsreader_400Regular_Italic,
  Newsreader_500Medium,
} from "@expo-google-fonts/newsreader";
import {
  InterTight_400Regular,
  InterTight_500Medium,
  InterTight_600SemiBold,
  InterTight_700Bold,
} from "@expo-google-fonts/inter-tight";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { AuthProvider, useAuth } from "@/lib/auth";
import { useTheme } from "@/shared/theme";
import { ToastProvider } from "@/components/ui/Toast";
import { Loading } from "@/components/ui/Primitives";
import { modalOptions } from "@/lib/nav";

export { ErrorFallback as ErrorBoundary } from "@/components/ErrorFallback";

SplashScreen.preventAutoHideAsync().catch(() => {});

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    Newsreader_400Regular,
    Newsreader_400Regular_Italic,
    Newsreader_500Medium,
    InterTight_400Regular,
    InterTight_500Medium,
    InterTight_600SemiBold,
    InterTight_700Bold,
  });

  // Fonts failing to load must not trap the user on the splash screen.
  if (!fontsLoaded && !fontError) return null;

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <AuthProvider>
        <ToastProvider>
          <RootStack />
        </ToastProvider>
      </AuthProvider>
    </GestureHandlerRootView>
  );
}

function RootStack() {
  const { colors, dark } = useTheme();
  const { ready, signedIn } = useAuth();

  useEffect(() => {
    if (ready) SplashScreen.hideAsync().catch(() => {});
  }, [ready]);

  if (!ready) return <Loading />;

  // On tablets and the web, keep a readable column rather than stretching
  // lines of type and photos across the whole screen.
  return (
    <View style={{ flex: 1, backgroundColor: colors.paper }}>
      <View style={{ flex: 1, width: "100%", maxWidth: 720, alignSelf: "center" }}>
      <StatusBar style={dark ? "light" : "dark"} />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: colors.paper },
          // Native push on each platform: iOS slide with edge-swipe back,
          // Android's own material transition.
          animation: "default",
        }}
      >
        <Stack.Protected guard={!signedIn}>
          <Stack.Screen name="login" options={{ animation: "fade" }} />
        </Stack.Protected>
        <Stack.Protected guard={signedIn}>
          <Stack.Screen name="index" />
          <Stack.Screen name="trips/index" options={{ animation: "fade" }} />
          <Stack.Screen name="trips/new" options={modalOptions} />
          <Stack.Screen name="trips/[tripId]" />
        </Stack.Protected>
      </Stack>
      </View>
    </View>
  );
}

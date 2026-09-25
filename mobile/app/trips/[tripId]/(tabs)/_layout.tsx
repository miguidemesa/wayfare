import { Pressable, View } from "react-native";
import { router, Tabs } from "expo-router";
import type { BottomTabBarProps } from "@react-navigation/bottom-tabs";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { GUTTER, radii, useTheme } from "@/shared/theme";
import { useTrip } from "@/lib/trip";
import { TripMasthead } from "@/components/trip/TripChrome";
import { Failure, Loading } from "@/components/ui/Primitives";
import { T } from "@/components/ui/T";

export { ErrorFallback as ErrorBoundary } from "@/components/ErrorFallback";

// Plan · Map · Spend — real tabs. Each keeps its own state (scroll, selection,
// map camera) while you move between them and while screens are pushed on top.
export default function TripTabs() {
  const { colors } = useTheme();
  const { bundle, error, reload } = useTrip();

  if (!bundle) {
    return error ? <Failure title="This trip didn't load" message={error} onRetry={() => void reload()} /> : <Loading label="Opening your trip" />;
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.paper }}>
      <TripMasthead bundle={bundle} />
      <Tabs
        tabBar={(props) => <TripTabBar {...props} tripId={bundle.trip.id} />}
        screenOptions={{ headerShown: false, sceneStyle: { backgroundColor: colors.paper } }}
      >
        <Tabs.Screen name="index" options={{ title: "Plan" }} />
        <Tabs.Screen name="map" options={{ title: "Map" }} />
        <Tabs.Screen name="spend" options={{ title: "Spend" }} />
      </Tabs>
    </View>
  );
}

function TripTabBar({ state, descriptors, navigation, tripId }: BottomTabBarProps & { tripId: string }) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();

  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        paddingHorizontal: GUTTER - 10,
        paddingBottom: Math.max(insets.bottom, 10),
        paddingTop: 8,
        borderTopWidth: 1,
        borderTopColor: colors.rule,
        backgroundColor: colors.paper,
      }}
      accessibilityRole="tablist"
    >
      {state.routes.map((route, index) => {
        const focused = state.index === index;
        const label = descriptors[route.key].options.title ?? route.name;
        return (
          <Pressable
            key={route.key}
            accessibilityRole="tab"
            aria-selected={focused}
            onPress={() => {
              const event = navigation.emit({ type: "tabPress", target: route.key, canPreventDefault: true });
              if (!focused && !event.defaultPrevented) navigation.navigate(route.name, route.params);
            }}
            style={{ paddingHorizontal: 10, height: 44, justifyContent: "center" }}
          >
            <T v="bodyStrong" style={{ fontSize: 16, color: focused ? colors.ink : colors.ink3 }}>
              {label}
            </T>
            <View style={{ position: "absolute", top: -9, left: 10, right: 10, height: 2, backgroundColor: focused ? colors.accent : "transparent" }} />
          </Pressable>
        );
      })}
      <View style={{ flex: 1 }} />
      <Pressable
        onPress={() => router.push(`/trips/${tripId}/add-expense`)}
        accessibilityRole="button"
        accessibilityLabel="Log an expense"
        style={({ pressed }) => ({
          flexDirection: "row",
          alignItems: "center",
          gap: 6,
          height: 44,
          paddingHorizontal: 14,
          marginRight: 10,
          borderRadius: radii.md,
          backgroundColor: colors.accent,
          opacity: pressed ? 0.8 : 1,
        })}
      >
        <Ionicons name="add" size={18} color={colors.onAccent} />
        <T v="bodyStrong" style={{ color: colors.onAccent }}>
          Expense
        </T>
      </Pressable>
    </View>
  );
}

import { useState } from "react";
import { Pressable, View } from "react-native";
import { router, Tabs } from "expo-router";
import type { BottomTabBarProps } from "@react-navigation/bottom-tabs";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated, { useReducedMotion } from "react-native-reanimated";
import { Ionicons } from "@expo/vector-icons";
import { GUTTER, motion, radii, type, useTheme } from "@/shared/theme";
import { useTransition } from "@/lib/motion";
import { useTrip } from "@/lib/trip";
import { TripMasthead, TripSkeleton } from "@/components/trip/TripChrome";
import { Failure } from "@/components/ui/Primitives";
import { Press } from "@/components/ui/Press";
import { T } from "@/components/ui/T";

export { ErrorFallback as ErrorBoundary } from "@/components/ErrorFallback";

// Plan · Map · Spend — real tabs. Each keeps its own state (scroll, selection,
// map camera) while you move between them and while screens are pushed on top.
export default function TripTabs() {
  const { colors } = useTheme();
  const { bundle, error, reload } = useTrip();
  const reduce = useReducedMotion();

  if (!bundle) {
    return error ? <Failure title="This trip didn't load" message={error} onRetry={() => void reload()} /> : <TripSkeleton />;
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.paper }}>
      <TripMasthead bundle={bundle} />
      <Tabs
        tabBar={(props) => <TripTabBar {...props} tripId={bundle.trip.id} />}
        // The tabs sit in a row, so switching shifts the page that way a little.
        screenOptions={{ headerShown: false, sceneStyle: { backgroundColor: colors.paper }, animation: reduce ? "none" : "shift" }}
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
  // Where each tab sits, so one accent line can glide to the focused one.
  const [spots, setSpots] = useState<{ x: number; w: number }[]>([]);
  const glide = useTransition(["transform", "width"]);
  const ink = useTransition("color", motion.fast);
  const spot = spots[state.index];

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
            onLayout={(e) => {
              const { x, width } = e.nativeEvent.layout;
              setSpots((s) => (s[index]?.x === x && s[index]?.w === width ? s : Object.assign([...s], { [index]: { x, w: width } })));
            }}
            onPress={() => {
              const event = navigation.emit({ type: "tabPress", target: route.key, canPreventDefault: true });
              if (!focused && !event.defaultPrevented) navigation.navigate(route.name, route.params);
            }}
            style={{ paddingHorizontal: 10, height: 44, justifyContent: "center" }}
          >
            <Animated.Text style={[type.bodyStrong, { fontSize: 16, color: focused ? colors.ink : colors.ink3 }, ink]}>{label}</Animated.Text>
          </Pressable>
        );
      })}
      {spot ? (
        <Animated.View
          pointerEvents="none"
          style={[
            { position: "absolute", top: -1, left: 0, height: 2, width: spot.w - 20, backgroundColor: colors.accent, transform: [{ translateX: spot.x + 10 }] },
            glide,
          ]}
        />
      ) : null}
      <View style={{ flex: 1 }} />
      <Press
        onPress={() => router.push(`/trips/${tripId}/add-expense`)}
        accessibilityRole="button"
        accessibilityLabel="Log an expense"
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: 6,
          height: 44,
          paddingHorizontal: 14,
          marginRight: 10,
          borderRadius: radii.md,
          borderCurve: "continuous",
          backgroundColor: colors.accent,
        }}
      >
        <Ionicons name="add" size={18} color={colors.onAccent} />
        <T v="bodyStrong" style={{ color: colors.onAccent }}>
          Expense
        </T>
      </Press>
    </View>
  );
}

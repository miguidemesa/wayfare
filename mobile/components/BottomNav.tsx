import React from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { router, usePathname } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { TRAVEL_THEME } from "@/shared/theme";

export type NavTabKey = "home" | "itinerary" | "map" | "ai" | "wallet";

interface BottomNavProps {
  tripId: string;
  activeTab?: NavTabKey;
  accentColor?: string;
}

export function BottomNav({
  tripId,
  activeTab,
  accentColor = TRAVEL_THEME.colors.terracotta,
}: BottomNavProps) {
  const insets = useSafeAreaInsets();
  const pathname = usePathname();

  // Auto-detect current tab from pathname if not explicitly passed
  const currentTab: NavTabKey = activeTab || (() => {
    if (pathname.includes("/itinerary")) return "itinerary";
    if (pathname.includes("/discover")) return "map";
    if (pathname.includes("/ai")) return "ai";
    if (
      pathname.includes("/expenses") ||
      pathname.includes("/documents") ||
      pathname.includes("/reservations") ||
      pathname.includes("/packing") ||
      pathname.includes("/currency") ||
      pathname.includes("/journal") ||
      pathname.includes("/wrapped")
    ) {
      return "wallet";
    }
    return "home";
  })();

  const tabs: {
    key: NavTabKey;
    label: string;
    icon: keyof typeof Ionicons.glyphMap;
    iconActive: keyof typeof Ionicons.glyphMap;
    route: string;
  }[] = [
    {
      key: "home",
      label: "Overview",
      icon: "compass-outline",
      iconActive: "compass",
      route: `/trips/${tripId}`,
    },
    {
      key: "itinerary",
      label: "Timeline",
      icon: "calendar-outline",
      iconActive: "calendar",
      route: `/trips/${tripId}/itinerary`,
    },
    {
      key: "map",
      label: "Explore",
      icon: "map-outline",
      iconActive: "map",
      route: `/trips/${tripId}/discover`,
    },
    {
      key: "ai",
      label: "Concierge",
      icon: "sparkles-outline",
      iconActive: "sparkles",
      route: `/trips/${tripId}/ai`,
    },
    {
      key: "wallet",
      label: "Vault",
      icon: "wallet-outline",
      iconActive: "wallet",
      route: `/trips/${tripId}/expenses`,
    },
  ];

  function handlePress(route: string) {
    router.replace(route as any);
  }

  return (
    <View
      pointerEvents="box-none"
      style={[
        styles.wrapper,
        {
          bottom: Math.max(insets.bottom, 12),
        },
      ]}
    >
      <View style={styles.container}>
        <View style={styles.tabRow}>
          {tabs.map((tab) => {
            const isActive = currentTab === tab.key;
            return (
              <TouchableOpacity
                key={tab.key}
                onPress={() => handlePress(tab.route)}
                activeOpacity={0.7}
                style={[
                  styles.tabButton,
                  isActive && styles.tabButtonActive,
                ]}
              >
                <Ionicons
                  name={isActive ? tab.iconActive : tab.icon}
                  size={20}
                  color={isActive ? accentColor : TRAVEL_THEME.colors.inkMuted}
                />
                <Text
                  style={[
                    styles.tabLabel,
                    isActive ? { color: accentColor, fontWeight: "700" } : { color: TRAVEL_THEME.colors.inkMuted },
                  ]}
                  numberOfLines={1}
                >
                  {tab.label}
                </Text>
                {isActive && (
                  <View style={[styles.activeDot, { backgroundColor: accentColor }]} />
                )}
              </TouchableOpacity>
            );
          })}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    position: "absolute",
    left: 16,
    right: 16,
    alignItems: "center",
    zIndex: 100,
  },
  container: {
    width: "100%",
    maxWidth: 480,
    backgroundColor: TRAVEL_THEME.colors.surface,
    borderRadius: 28,
    borderWidth: 1,
    borderColor: TRAVEL_THEME.colors.border,
    paddingHorizontal: 8,
    paddingVertical: 6,
    ...TRAVEL_THEME.shadows.hover,
  },
  tabRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  tabButton: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 6,
    paddingHorizontal: 2,
    borderRadius: 20,
    position: "relative",
  },
  tabButtonActive: {
    backgroundColor: TRAVEL_THEME.colors.surfaceWarm,
  },
  tabLabel: {
    fontSize: 10.5,
    fontWeight: "500",
    letterSpacing: 0.1,
    marginTop: 2,
  },
  activeDot: {
    position: "absolute",
    bottom: 2,
    width: 3.5,
    height: 3.5,
    borderRadius: 2,
  },
});

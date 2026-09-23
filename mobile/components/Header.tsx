import React from "react";
import { StyleSheet, Text, TouchableOpacity, View, ViewStyle } from "react-native";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { TRAVEL_THEME } from "@/shared/theme";

export interface HeaderProps {
  title?: string;
  eyebrow?: string;
  showBack?: boolean;
  onBack?: () => void;
  rightAction?: React.ReactNode;
  transparent?: boolean;
  dark?: boolean;
  style?: ViewStyle;
}

export function Header({
  title,
  eyebrow,
  showBack = true,
  onBack,
  rightAction,
  transparent = false,
  dark = false,
  style,
}: HeaderProps) {
  const handleBack = () => {
    if (onBack) onBack();
    else if (router.canGoBack()) router.back();
    else router.replace("/trips");
  };

  const textColor = dark ? "#FFFFFF" : TRAVEL_THEME.colors.inkPrimary;
  const eyebrowColor = dark ? "rgba(255, 255, 255, 0.65)" : TRAVEL_THEME.colors.terracotta;
  const btnBg = dark ? "rgba(0, 0, 0, 0.45)" : TRAVEL_THEME.colors.surface;
  const btnBorder = dark ? "rgba(255, 255, 255, 0.15)" : TRAVEL_THEME.colors.border;
  const iconColor = dark ? "#FFFFFF" : TRAVEL_THEME.colors.inkPrimary;

  return (
    <View
      style={[
        styles.container,
        !transparent && {
          backgroundColor: TRAVEL_THEME.colors.bg,
          borderBottomWidth: 1,
          borderBottomColor: TRAVEL_THEME.colors.border,
        },
        style,
      ]}
    >
      <View style={styles.leftRow}>
        {showBack && (
          <TouchableOpacity
            onPress={handleBack}
            activeOpacity={0.75}
            style={[
              styles.backButton,
              { backgroundColor: btnBg, borderColor: btnBorder },
            ]}
          >
            <Ionicons name="arrow-back" size={18} color={iconColor} />
          </TouchableOpacity>
        )}
        <View style={styles.titleContainer}>
          {eyebrow ? (
            <Text
              style={[
                styles.eyebrow,
                { color: eyebrowColor },
              ]}
              numberOfLines={1}
            >
              {eyebrow.toUpperCase()}
            </Text>
          ) : null}
          {title ? (
            <Text
              style={[
                styles.title,
                { color: textColor },
              ]}
              numberOfLines={1}
            >
              {title}
            </Text>
          ) : null}
        </View>
      </View>

      {rightAction && <View style={styles.rightContainer}>{rightAction}</View>}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    minHeight: 56,
  },
  leftRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    flex: 1,
  },
  backButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    ...TRAVEL_THEME.shadows.card,
  },
  titleContainer: {
    flex: 1,
    justifyContent: "center",
  },
  eyebrow: {
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 1.2,
    marginBottom: 1,
  },
  title: {
    fontFamily: "Georgia",
    fontSize: 19,
    fontWeight: "600",
    letterSpacing: -0.2,
  },
  rightContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
});

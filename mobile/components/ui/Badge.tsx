import React from "react";
import { StyleProp, StyleSheet, Text, TextStyle, View, ViewStyle } from "react-native";
import { TABULAR_NUMS, TRAVEL_THEME } from "@/shared/theme";

export interface BadgeProps {
  label: string;
  icon?: React.ReactNode;
  variant?: "neutral" | "terracotta" | "forest" | "ocean" | "amber" | "dark" | "outline";
  size?: "sm" | "md";
  style?: StyleProp<ViewStyle>;
  textStyle?: StyleProp<TextStyle>;
  color?: string;
  bgColor?: string;
  borderColor?: string;
}

export function Badge({
  label,
  icon,
  variant = "neutral",
  size = "md",
  style,
  textStyle,
  color,
  bgColor,
  borderColor,
}: BadgeProps) {
  const getColors = () => {
    if (bgColor || color) {
      return {
        bg: bgColor || TRAVEL_THEME.colors.bgMuted,
        text: color || TRAVEL_THEME.colors.inkPrimary,
        border: borderColor || "transparent",
      };
    }
    switch (variant) {
      case "terracotta":
        return {
          bg: TRAVEL_THEME.colors.terracottaLight,
          text: TRAVEL_THEME.colors.terracottaDark,
          border: "#F0D7D0",
        };
      case "forest":
        return {
          bg: TRAVEL_THEME.colors.forestLight,
          text: TRAVEL_THEME.colors.forestDark,
          border: "#D6E5DC",
        };
      case "ocean":
        return {
          bg: TRAVEL_THEME.colors.oceanLight,
          text: TRAVEL_THEME.colors.oceanDark,
          border: "#D3E1EE",
        };
      case "amber":
        return {
          bg: TRAVEL_THEME.colors.amberLight,
          text: TRAVEL_THEME.colors.amberDark,
          border: "#F5E4CE",
        };
      case "dark":
        return {
          bg: TRAVEL_THEME.colors.surfaceDark,
          text: "#FFFFFF",
          border: "transparent",
        };
      case "outline":
        return {
          bg: "transparent",
          text: TRAVEL_THEME.colors.inkSecondary,
          border: TRAVEL_THEME.colors.borderStrong,
        };
      case "neutral":
      default:
        return {
          bg: TRAVEL_THEME.colors.bgMuted,
          text: TRAVEL_THEME.colors.inkSecondary,
          border: TRAVEL_THEME.colors.border,
        };
    }
  };

  const palette = getColors();
  const isSmall = size === "sm";

  return (
    <View
      style={[
        {
          flexDirection: "row",
          alignItems: "center",
          alignSelf: "flex-start",
          paddingHorizontal: isSmall ? 7 : 10,
          paddingVertical: isSmall ? 2.5 : 4,
          borderRadius: isSmall ? 6 : 8,
          backgroundColor: palette.bg,
          borderWidth: 1,
          borderColor: palette.border,
          gap: 4,
        },
        style,
      ]}
    >
      {icon}
      <Text
        style={[
          {
            fontSize: isSmall ? 10.5 : 11.5,
            fontWeight: "600",
            color: palette.text,
            letterSpacing: 0.2,
          },
          TABULAR_NUMS,
          textStyle,
        ]}
      >
        {label}
      </Text>
    </View>
  );
}

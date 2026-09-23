import React from "react";
import { StyleProp, StyleSheet, View, ViewProps, ViewStyle } from "react-native";
import { TRAVEL_THEME } from "@/shared/theme";

export interface SurfaceProps extends ViewProps {
  variant?: "card" | "muted" | "sand" | "dark" | "outline";
  borderRadius?: number;
  borderWidth?: number;
  borderColor?: string;
  style?: StyleProp<ViewStyle>;
  children?: React.ReactNode;
}

export function Surface({
  variant = "card",
  borderRadius = TRAVEL_THEME.radii.lg,
  borderWidth = 1,
  borderColor,
  style,
  children,
  ...rest
}: SurfaceProps) {
  const getVariantStyle = (): ViewStyle => {
    switch (variant) {
      case "card":
        return {
          backgroundColor: TRAVEL_THEME.colors.surface,
          borderColor: borderColor || TRAVEL_THEME.colors.border,
          ...TRAVEL_THEME.shadows.card,
        };
      case "muted":
        return {
          backgroundColor: TRAVEL_THEME.colors.bgMuted,
          borderColor: borderColor || TRAVEL_THEME.colors.borderSubtle,
        };
      case "sand":
        return {
          backgroundColor: TRAVEL_THEME.colors.surfaceWarm,
          borderColor: borderColor || TRAVEL_THEME.colors.border,
        };
      case "dark":
        return {
          backgroundColor: TRAVEL_THEME.colors.surfaceDark,
          borderColor: borderColor || "rgba(255, 255, 255, 0.12)",
          ...TRAVEL_THEME.shadows.hover,
        };
      case "outline":
        return {
          backgroundColor: "transparent",
          borderColor: borderColor || TRAVEL_THEME.colors.borderStrong,
        };
    }
  };

  return (
    <View
      style={[
        {
          borderRadius,
          borderWidth,
          overflow: "hidden",
        },
        getVariantStyle(),
        style,
      ]}
      {...rest}
    >
      {children}
    </View>
  );
}

export function Card({
  padding = 18,
  style,
  children,
  ...rest
}: SurfaceProps & { padding?: number }) {
  return (
    <Surface
      variant="card"
      style={[{ padding }, style]}
      {...rest}
    >
      {children}
    </Surface>
  );
}

import React from "react";
import {
  ActivityIndicator,
  StyleProp,
  StyleSheet,
  Text,
  TextStyle,
  TouchableOpacity,
  TouchableOpacityProps,
  View,
  ViewStyle,
} from "react-native";
import { TRAVEL_THEME } from "@/shared/theme";

export interface ButtonProps extends TouchableOpacityProps {
  label?: string;
  variant?: "primary" | "dark" | "secondary" | "outline" | "ghost" | "danger";
  size?: "sm" | "md" | "lg";
  iconLeft?: React.ReactNode;
  iconRight?: React.ReactNode;
  loading?: boolean;
  style?: StyleProp<ViewStyle>;
  textStyle?: StyleProp<TextStyle>;
  children?: React.ReactNode;
}

export function Button({
  label,
  variant = "primary",
  size = "md",
  iconLeft,
  iconRight,
  loading = false,
  disabled,
  style,
  textStyle,
  children,
  ...rest
}: ButtonProps) {
  const getStyles = (): { btn: ViewStyle; text: TextStyle; indicatorColor: string } => {
    let btn: ViewStyle = {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 7,
      borderRadius: TRAVEL_THEME.radii.md,
    };
    let text: TextStyle = {
      fontWeight: "600",
      letterSpacing: 0.2,
    };
    let indicatorColor = "#FFFFFF";

    // Size
    switch (size) {
      case "sm":
        btn.paddingHorizontal = 12;
        btn.paddingVertical = 8;
        btn.minHeight = 36;
        text.fontSize = 12.5;
        break;
      case "lg":
        btn.paddingHorizontal = 22;
        btn.paddingVertical = 16;
        btn.minHeight = 52;
        text.fontSize = 15.5;
        btn.borderRadius = TRAVEL_THEME.radii.lg;
        break;
      case "md":
      default:
        btn.paddingHorizontal = 16;
        btn.paddingVertical = 12;
        btn.minHeight = 44;
        text.fontSize = 14;
        break;
    }

    // Variant
    switch (variant) {
      case "primary":
        btn.backgroundColor = TRAVEL_THEME.colors.terracotta;
        text.color = "#FFFFFF";
        indicatorColor = "#FFFFFF";
        break;
      case "dark":
        btn.backgroundColor = TRAVEL_THEME.colors.inkPrimary;
        text.color = "#FFFFFF";
        indicatorColor = "#FFFFFF";
        break;
      case "secondary":
        btn.backgroundColor = TRAVEL_THEME.colors.bgMuted;
        btn.borderWidth = 1;
        btn.borderColor = TRAVEL_THEME.colors.border;
        text.color = TRAVEL_THEME.colors.inkPrimary;
        indicatorColor = TRAVEL_THEME.colors.inkPrimary;
        break;
      case "outline":
        btn.backgroundColor = "transparent";
        btn.borderWidth = 1;
        btn.borderColor = TRAVEL_THEME.colors.borderStrong;
        text.color = TRAVEL_THEME.colors.inkPrimary;
        indicatorColor = TRAVEL_THEME.colors.inkPrimary;
        break;
      case "ghost":
        btn.backgroundColor = "transparent";
        text.color = TRAVEL_THEME.colors.inkSecondary;
        indicatorColor = TRAVEL_THEME.colors.inkSecondary;
        break;
      case "danger":
        btn.backgroundColor = TRAVEL_THEME.colors.dangerLight;
        btn.borderWidth = 1;
        btn.borderColor = "#F4D2CE";
        text.color = TRAVEL_THEME.colors.danger;
        indicatorColor = TRAVEL_THEME.colors.danger;
        break;
    }

    if (disabled) {
      btn.opacity = 0.55;
    }

    return { btn, text, indicatorColor };
  };

  const { btn, text, indicatorColor } = getStyles();

  return (
    <TouchableOpacity
      activeOpacity={0.8}
      disabled={disabled || loading}
      style={[btn, style]}
      {...rest}
    >
      {loading ? (
        <ActivityIndicator size="small" color={indicatorColor} />
      ) : (
        <>
          {iconLeft}
          {label ? <Text style={[text, textStyle]}>{label}</Text> : null}
          {children}
          {iconRight}
        </>
      )}
    </TouchableOpacity>
  );
}

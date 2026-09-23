import React from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { TRAVEL_THEME } from "@/shared/theme";

export interface SegmentOption<T extends string> {
  key: T;
  label: string;
  count?: number;
  icon?: React.ReactNode;
}

export interface SegmentedControlProps<T extends string> {
  options: SegmentOption<T>[];
  value: T;
  onChange: (val: T) => void;
  accentColor?: string;
}

export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  accentColor = TRAVEL_THEME.colors.terracotta,
}: SegmentedControlProps<T>) {
  return (
    <View style={styles.track}>
      {options.map((opt) => {
        const isSelected = value === opt.key;
        return (
          <TouchableOpacity
            key={opt.key}
            onPress={() => onChange(opt.key)}
            activeOpacity={0.8}
            style={[
              styles.pill,
              isSelected && styles.pillSelected,
            ]}
          >
            {opt.icon}
            <Text
              style={[
                styles.label,
                isSelected ? styles.labelSelected : styles.labelUnselected,
              ]}
              numberOfLines={1}
            >
              {opt.label}
              {opt.count !== undefined ? ` (${opt.count})` : ""}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    flexDirection: "row",
    backgroundColor: TRAVEL_THEME.colors.bgMuted,
    borderRadius: TRAVEL_THEME.radii.md,
    padding: 3,
    borderWidth: 1,
    borderColor: TRAVEL_THEME.colors.border,
  },
  pill: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 8,
    borderRadius: TRAVEL_THEME.radii.sm,
    gap: 5,
  },
  pillSelected: {
    backgroundColor: TRAVEL_THEME.colors.surface,
    ...TRAVEL_THEME.shadows.card,
    borderWidth: 1,
    borderColor: TRAVEL_THEME.colors.borderSubtle,
  },
  label: {
    fontSize: 13,
    letterSpacing: 0.1,
  },
  labelSelected: {
    fontWeight: "600",
    color: TRAVEL_THEME.colors.inkPrimary,
  },
  labelUnselected: {
    fontWeight: "500",
    color: TRAVEL_THEME.colors.inkMuted,
  },
});

import React from "react";
import {
  StyleProp,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  ViewProps,
  ViewStyle,
} from "react-native";
import { TABULAR_NUMS, TRAVEL_THEME } from "@/shared/theme";
import { Card, Surface, SurfaceProps } from "./ui/Surface";
import { Badge, BadgeProps } from "./ui/Badge";
import { SegmentedControl, SegmentedControlProps } from "./ui/SegmentedControl";

export type GlassMaterial = "ultraThin" | "thin" | "regular" | "thick" | "chrome" | "frostedNav";

export interface GlassViewProps extends ViewProps {
  material?: GlassMaterial;
  intensity?: number;
  borderRadius?: number;
  borderWidth?: number;
  borderColor?: string;
  highlightTop?: boolean;
  style?: StyleProp<ViewStyle>;
  children?: React.ReactNode;
}

/**
 * Clean tactile surface container replacing dark glassmorphism.
 */
export function GlassView({
  borderRadius = TRAVEL_THEME.radii.lg,
  borderWidth = 1,
  borderColor,
  style,
  children,
  ...rest
}: GlassViewProps) {
  return (
    <Surface
      variant="card"
      borderRadius={borderRadius}
      borderWidth={borderWidth}
      borderColor={borderColor}
      style={style}
      {...rest}
    >
      {children}
    </Surface>
  );
}

/**
 * Editorial tactile travel card
 */
export function GlassCard({
  borderRadius = TRAVEL_THEME.radii.lg,
  padding = 18,
  style,
  children,
  ...rest
}: GlassViewProps & { padding?: number }) {
  return (
    <Card
      borderRadius={borderRadius}
      padding={padding}
      style={style}
      {...rest}
    >
      {children}
    </Card>
  );
}

/**
 * Clean travel metadata badge
 */
export function GlassBadge({
  label,
  icon,
  color,
  bgColor,
  borderColor,
}: {
  label: string;
  icon?: React.ReactNode | string;
  color?: string;
  bgColor?: string;
  borderColor?: string;
}) {
  return (
    <Badge
      label={label}
      icon={typeof icon === "string" ? <Text style={{ fontSize: 11 }}>{icon}</Text> : icon}
      color={color}
      bgColor={bgColor}
      borderColor={borderColor}
    />
  );
}

/**
 * Compact Travel Metadata Cluster (12 min · 1.2 km · 4.8 ★ · OPEN NOW)
 */
export function MetadataCluster({
  items,
  style,
}: {
  items: { text: string; icon?: React.ReactNode | string; color?: string; bold?: boolean }[];
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <View style={[{ flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: 6 }, style]}>
      {items.map((item, idx) => (
        <React.Fragment key={idx}>
          {idx > 0 && <Text style={{ color: TRAVEL_THEME.colors.inkDim, fontSize: 11 }}>·</Text>}
          <View style={{ flexDirection: "row", alignItems: "center", gap: 3.5 }}>
            {typeof item.icon === "string" ? (
              <Text style={{ fontSize: 11.5 }}>{item.icon}</Text>
            ) : (
              item.icon
            )}
            <Text
              style={[
                {
                  fontSize: 12,
                  fontWeight: item.bold ? "700" : "500",
                  color: item.color || TRAVEL_THEME.colors.inkSecondary,
                  letterSpacing: 0.1,
                },
                TABULAR_NUMS,
              ]}
            >
              {item.text}
            </Text>
          </View>
        </React.Fragment>
      ))}
    </View>
  );
}

/**
 * Tactile Segmented Control
 */
export function GlassSegmentedControl<T extends string>(props: {
  options: { key: T; label: string; count?: number; icon?: string }[];
  value: T;
  onChange: (val: T) => void;
  accentColor?: string;
}) {
  return (
    <SegmentedControl
      options={props.options.map((o) => ({
        ...o,
        icon: o.icon ? <Text style={{ fontSize: 12 }}>{o.icon}</Text> : undefined,
      }))}
      value={props.value}
      onChange={props.onChange}
      accentColor={props.accentColor}
    />
  );
}

/**
 * Drag Handle indicator for bottom sheets
 */
export function SheetHandle() {
  return (
    <View
      style={{
        width: 36,
        height: 4,
        borderRadius: 2,
        backgroundColor: TRAVEL_THEME.colors.borderStrong,
        alignSelf: "center",
        marginBottom: 12,
        marginTop: 2,
      }}
    />
  );
}

/**
 * Ambient glow replacement: renders null to eliminate neon sci-fi background blobs
 */
export function AmbientGlow(_props: any) {
  return null;
}

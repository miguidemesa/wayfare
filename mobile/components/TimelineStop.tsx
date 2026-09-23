import React from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import type { ItineraryItem } from "@/shared/types";
import { fmtClock, fmtMoney, TABULAR_NUMS, TRAVEL_THEME } from "@/shared/theme";
import { Badge } from "./ui/Badge";
import { Card } from "./ui/Surface";

export interface TimelineStopProps {
  item: ItineraryItem;
  isFirst?: boolean;
  currency?: string;
  onToggleConfirm: (item: ItineraryItem) => void;
  onDelete: (itemId: string, title: string) => void;
  onPress?: (item: ItineraryItem) => void;
}

export function TimelineStop({
  item,
  isFirst = false,
  currency = "USD",
  onToggleConfirm,
  onDelete,
  onPress,
}: TimelineStopProps) {
  const { iconName, badgeVariant, color } = getTypeMeta(item.type);
  const transitMin = item.transportMin || 15;

  return (
    <View style={styles.container}>
      {/* Transit Connector between stops */}
      {!isFirst && (
        <View style={styles.transitRow}>
          <View style={styles.transitRail}>
            <View style={styles.dashedLine} />
          </View>
          <View style={styles.transitPill}>
            <Ionicons name="arrow-down" size={10} color={TRAVEL_THEME.colors.inkMuted} />
            <Text style={styles.transitText}>
              ~{transitMin} min walk / transit
            </Text>
          </View>
        </View>
      )}

      {/* Main Stop Row */}
      <View style={styles.stopRow}>
        {/* Left Node & Time Column */}
        <View style={styles.nodeColumn}>
          <View
            style={[
              styles.iconNode,
              { backgroundColor: item.confirmed ? TRAVEL_THEME.colors.bgMuted : color },
            ]}
          >
            <Ionicons
              name={iconName as any}
              size={13}
              color={item.confirmed ? TRAVEL_THEME.colors.inkMuted : "#FFFFFF"}
            />
          </View>
          <View style={styles.verticalTrack} />
        </View>

        {/* Stop Content Card */}
        <TouchableOpacity
          activeOpacity={0.85}
          onPress={() => onPress?.(item)}
          style={{ flex: 1 }}
        >
          <Card
            padding={14}
            style={[
              styles.card,
              item.confirmed && styles.cardConfirmed,
            ]}
          >
            <View style={styles.cardHeader}>
              <View style={styles.titleRow}>
                {/* Checkbox for completion */}
                <TouchableOpacity
                  onPress={() => onToggleConfirm(item)}
                  activeOpacity={0.7}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  style={[
                    styles.checkbox,
                    item.confirmed && styles.checkboxChecked,
                  ]}
                >
                  {item.confirmed && (
                    <Ionicons name="checkmark" size={12} color="#FFFFFF" />
                  )}
                </TouchableOpacity>

                <View style={{ flex: 1 }}>
                  <Text
                    style={[
                      styles.itemTitle,
                      item.confirmed && styles.itemTitleConfirmed,
                    ]}
                    numberOfLines={1}
                  >
                    {item.title}
                  </Text>
                </View>
              </View>

              <View style={styles.metaRow}>
                <Badge
                  label={item.type}
                  variant={badgeVariant}
                  size="sm"
                />
                <TouchableOpacity
                  onPress={() => onDelete(item.id, item.title)}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                  style={styles.deleteBtn}
                >
                  <Ionicons name="close" size={14} color={TRAVEL_THEME.colors.inkDim} />
                </TouchableOpacity>
              </View>
            </View>

            {/* Metadata row: Time, Place, Cost */}
            <View style={styles.detailsRow}>
              {item.startTime != null && (
                <View style={styles.detailItem}>
                  <Ionicons name="time-outline" size={12} color={TRAVEL_THEME.colors.terracotta} />
                  <Text style={[styles.timeText, TABULAR_NUMS]}>
                    {fmtClock(item.startTime)}
                  </Text>
                </View>
              )}

              {item.durationMin > 0 && (
                <View style={styles.detailItem}>
                  <Ionicons name="hourglass-outline" size={12} color={TRAVEL_THEME.colors.inkMuted} />
                  <Text style={[styles.detailText, TABULAR_NUMS]}>
                    {item.durationMin}m
                  </Text>
                </View>
              )}

              {(item.placeName || item.neighborhood) && (
                <View style={[styles.detailItem, { flex: 1 }]}>
                  <Ionicons name="location-outline" size={12} color={TRAVEL_THEME.colors.inkMuted} />
                  <Text style={styles.detailText} numberOfLines={1}>
                    {item.placeName || item.neighborhood}
                  </Text>
                </View>
              )}

              {item.cost ? (
                <View style={styles.detailItem}>
                  <Text style={[styles.costText, TABULAR_NUMS]}>
                    {fmtMoney(item.cost, item.currency ?? currency)}
                  </Text>
                </View>
              ) : null}
            </View>

            {/* Notes quote if present */}
            {item.notes ? (
              <View style={styles.notesContainer}>
                <Text style={styles.notesText} numberOfLines={2}>
                  “{item.notes}”
                </Text>
              </View>
            ) : null}
          </Card>
        </TouchableOpacity>
      </View>
    </View>
  );
}

function getTypeMeta(type: string): {
  iconName: string;
  badgeVariant: "terracotta" | "forest" | "ocean" | "amber" | "neutral";
  color: string;
} {
  const norm = (type || "").toUpperCase();
  if (norm.includes("FLIGHT")) {
    return { iconName: "airplane", badgeVariant: "ocean", color: TRAVEL_THEME.colors.ocean };
  }
  if (norm.includes("HOTEL") || norm.includes("STAY")) {
    return { iconName: "bed", badgeVariant: "ocean", color: TRAVEL_THEME.colors.oceanDark };
  }
  if (norm.includes("RESTAURANT") || norm.includes("FOOD") || norm.includes("DINING")) {
    return { iconName: "restaurant", badgeVariant: "amber", color: TRAVEL_THEME.colors.amber };
  }
  if (norm.includes("TRANSPORT") || norm.includes("TRANSIT")) {
    return { iconName: "subway", badgeVariant: "neutral", color: TRAVEL_THEME.colors.inkSecondary };
  }
  if (norm.includes("RESERVATION")) {
    return { iconName: "bookmark", badgeVariant: "terracotta", color: TRAVEL_THEME.colors.terracottaDark };
  }
  return { iconName: "sparkles", badgeVariant: "terracotta", color: TRAVEL_THEME.colors.terracotta };
}

const styles = StyleSheet.create({
  container: {
    position: "relative",
  },
  transitRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 5,
  },
  transitRail: {
    width: 32,
    alignItems: "center",
    justifyContent: "center",
  },
  dashedLine: {
    width: 1.5,
    height: 18,
    backgroundColor: TRAVEL_THEME.colors.borderStrong,
  },
  transitPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: TRAVEL_THEME.colors.bgMuted,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    marginLeft: 6,
    borderWidth: 1,
    borderColor: TRAVEL_THEME.colors.borderSubtle,
  },
  transitText: {
    fontSize: 10.5,
    fontWeight: "500",
    color: TRAVEL_THEME.colors.inkMuted,
  },
  stopRow: {
    flexDirection: "row",
    alignItems: "flex-start",
  },
  nodeColumn: {
    width: 32,
    alignItems: "center",
    paddingTop: 14,
  },
  iconNode: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1.5,
    borderColor: "#FFFFFF",
    ...TRAVEL_THEME.shadows.card,
    zIndex: 2,
  },
  verticalTrack: {
    position: "absolute",
    top: 38,
    bottom: -10,
    width: 1.5,
    backgroundColor: TRAVEL_THEME.colors.border,
  },
  card: {
    backgroundColor: TRAVEL_THEME.colors.surface,
    borderColor: TRAVEL_THEME.colors.border,
  },
  cardConfirmed: {
    opacity: 0.65,
    backgroundColor: TRAVEL_THEME.colors.bgMuted,
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 9,
    flex: 1,
    paddingRight: 8,
  },
  checkbox: {
    width: 18,
    height: 18,
    borderRadius: 5,
    borderWidth: 1.5,
    borderColor: TRAVEL_THEME.colors.borderStrong,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FFFFFF",
  },
  checkboxChecked: {
    backgroundColor: TRAVEL_THEME.colors.forest,
    borderColor: TRAVEL_THEME.colors.forest,
  },
  itemTitle: {
    fontSize: 14.5,
    fontWeight: "600",
    color: TRAVEL_THEME.colors.inkPrimary,
    letterSpacing: -0.1,
  },
  itemTitleConfirmed: {
    textDecorationLine: "line-through",
    color: TRAVEL_THEME.colors.inkMuted,
  },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  deleteBtn: {
    padding: 2,
  },
  detailsRow: {
    marginTop: 8,
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 12,
  },
  detailItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3.5,
  },
  timeText: {
    fontSize: 12,
    fontWeight: "700",
    color: TRAVEL_THEME.colors.terracotta,
  },
  detailText: {
    fontSize: 12,
    fontWeight: "500",
    color: TRAVEL_THEME.colors.inkMuted,
  },
  costText: {
    fontSize: 12,
    fontWeight: "600",
    color: TRAVEL_THEME.colors.inkPrimary,
  },
  notesContainer: {
    marginTop: 8,
    paddingTop: 6,
    borderTopWidth: 1,
    borderTopColor: TRAVEL_THEME.colors.borderSubtle,
  },
  notesText: {
    fontSize: 11.5,
    fontStyle: "italic",
    color: TRAVEL_THEME.colors.inkMuted,
    lineHeight: 16,
  },
});

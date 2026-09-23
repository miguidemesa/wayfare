import React, { useState } from "react";
import {
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Badge } from "./ui/Badge";
import { Button } from "./ui/Button";
import { SheetHandle } from "./GlassView";
import type { POI, SavedPlace } from "@/shared/types";
import { CATEGORY_PLACEHOLDERS } from "@/shared/images";
import { fmtDistance, fmtMoney, hexA, TABULAR_NUMS, TRAVEL_THEME } from "@/shared/theme";

export type SheetStage = "PEEK" | "HALF" | "FULL";

interface DraggableSheetProps {
  place: POI | SavedPlace | null;
  onClose?: () => void;
  onAddToItinerary: (place: POI | SavedPlace) => void;
  onToggleSave?: (place: POI | SavedPlace) => void;
  isSaved?: boolean;
  accentColor?: string;
  homeCurrency?: string;
}

export function DraggableSheet({
  place,
  onClose,
  onAddToItinerary,
  onToggleSave,
  isSaved = false,
  accentColor = TRAVEL_THEME.colors.terracotta,
  homeCurrency = "USD",
}: DraggableSheetProps) {
  const [stage, setStage] = useState<SheetStage>("HALF");

  if (!place) return null;

  const category = "category" in place ? place.category : "ATTRACTION";
  const rating = "rating" in place && place.rating ? place.rating : 4.8;
  const image = CATEGORY_PLACEHOLDERS[category] || CATEGORY_PLACEHOLDERS.ATTRACTION;
  const walkMin = "walkMin" in place ? place.walkMin : 12;
  const hours = "hours" in place ? place.hours : "09:00 – 21:00";
  const blurb = "blurb" in place ? place.blurb : place.address || "Curated destination stop.";
  const avgCost = "avgCost" in place ? place.avgCost : undefined;

  function cycleStage() {
    if (stage === "PEEK") setStage("HALF");
    else if (stage === "HALF") setStage("FULL");
    else setStage("PEEK");
  }

  const sheetHeight = stage === "PEEK" ? 130 : stage === "HALF" ? 360 : 540;

  return (
    <View style={[styles.sheetContainer, { height: sheetHeight }]}>
      <View style={styles.sheetBody}>
        <TouchableOpacity onPress={cycleStage} activeOpacity={0.9} style={styles.dragArea}>
          <SheetHandle />
        </TouchableOpacity>

        {/* Header Preview Row */}
        <View style={styles.headerRow}>
          <Image source={{ uri: image }} style={styles.thumbImage} resizeMode="cover" />
          <View style={styles.headerText}>
            <Text style={styles.placeTitle} numberOfLines={1}>
              {place.name}
            </Text>
            <View style={styles.badgeRow}>
              <Badge
                label={`${rating.toFixed(1)} ★`}
                variant="amber"
                size="sm"
              />
              <Badge
                label={`${walkMin ?? 12}m walk`}
                variant="neutral"
                size="sm"
              />
              <Text style={styles.hoursText} numberOfLines={1}>
                {hours.split("–")[0]?.trim() || "Open"}
              </Text>
            </View>
          </View>
          {onClose && (
            <TouchableOpacity onPress={onClose} style={styles.closeBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Ionicons name="close" size={18} color={TRAVEL_THEME.colors.inkMuted} />
            </TouchableOpacity>
          )}
        </View>

        {/* Expanded Details */}
        {stage !== "PEEK" && (
          <ScrollView
            style={{ flex: 1 }}
            contentContainerStyle={styles.expandedContent}
            showsVerticalScrollIndicator={false}
          >
            <Text style={styles.blurbText}>{blurb}</Text>

            {avgCost ? (
              <View style={styles.costBox}>
                <Text style={styles.costLabel}>ESTIMATED AVERAGE</Text>
                <Text style={[styles.costValue, TABULAR_NUMS]}>
                  {fmtMoney(avgCost, homeCurrency)} per person
                </Text>
              </View>
            ) : null}

            {/* Quick Actions */}
            <View style={styles.actionRow}>
              <Button
                label="Add to Itinerary"
                iconLeft={<Ionicons name="add" size={18} color="#FFFFFF" />}
                variant="primary"
                size="md"
                onPress={() => onAddToItinerary(place)}
                style={{ flex: 1 }}
              />
              {onToggleSave && (
                <Button
                  label={isSaved ? "Saved" : "Save"}
                  iconLeft={
                    <Ionicons
                      name={isSaved ? "bookmark" : "bookmark-outline"}
                      size={18}
                      color={isSaved ? TRAVEL_THEME.colors.terracotta : TRAVEL_THEME.colors.inkPrimary}
                    />
                  }
                  variant="secondary"
                  size="md"
                  onPress={() => onToggleSave(place)}
                />
              )}
            </View>
          </ScrollView>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  sheetContainer: {
    position: "absolute",
    left: 12,
    right: 12,
    bottom: 84,
    zIndex: 90,
  },
  sheetBody: {
    flex: 1,
    backgroundColor: TRAVEL_THEME.colors.surface,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: TRAVEL_THEME.colors.border,
    paddingHorizontal: 16,
    paddingBottom: 16,
    ...TRAVEL_THEME.shadows.modal,
  },
  dragArea: {
    paddingVertical: 6,
    alignItems: "center",
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  thumbImage: {
    width: 52,
    height: 52,
    borderRadius: 12,
  },
  headerText: {
    flex: 1,
  },
  placeTitle: {
    fontFamily: "Georgia",
    fontSize: 16,
    fontWeight: "600",
    color: TRAVEL_THEME.colors.inkPrimary,
  },
  badgeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 4,
  },
  hoursText: {
    fontSize: 11.5,
    color: TRAVEL_THEME.colors.inkMuted,
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: TRAVEL_THEME.colors.bgMuted,
  },
  expandedContent: {
    paddingTop: 14,
    gap: 12,
  },
  blurbText: {
    fontSize: 13,
    lineHeight: 19,
    color: TRAVEL_THEME.colors.inkSecondary,
  },
  costBox: {
    backgroundColor: TRAVEL_THEME.colors.surfaceWarm,
    padding: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: TRAVEL_THEME.colors.border,
  },
  costLabel: {
    fontSize: 9.5,
    fontWeight: "700",
    letterSpacing: 0.8,
    color: TRAVEL_THEME.colors.inkMuted,
  },
  costValue: {
    marginTop: 2,
    fontSize: 14,
    fontWeight: "600",
    color: TRAVEL_THEME.colors.inkPrimary,
  },
  actionRow: {
    flexDirection: "row",
    gap: 10,
    marginTop: 4,
  },
});

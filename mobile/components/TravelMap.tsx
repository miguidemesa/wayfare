import React from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import type { POI, SavedPlace } from "@/shared/types";
import { TRAVEL_THEME } from "@/shared/theme";

interface TravelMapProps {
  places: (POI | SavedPlace)[];
  selectedPlaceId?: string;
  onSelectPlace: (place: POI | SavedPlace) => void;
  accentColor?: string;
  cityName?: string;
}

export function getPlaceId(p: POI | SavedPlace): string {
  return "poiId" in p ? p.poiId : p.id;
}

export function TravelMap({
  places,
  selectedPlaceId,
  onSelectPlace,
  accentColor = TRAVEL_THEME.colors.terracotta,
  cityName = "Tokyo",
}: TravelMapProps) {
  // Distribute places across an organic cartographic canvas
  const mappedPoints = places.slice(0, 10).map((p, index) => {
    // Generate organic positions across the map
    const angle = (index / Math.max(places.length, 1)) * Math.PI * 2 + 0.3;
    const radius = 95 + (index % 3) * 38;
    const x = Math.round(180 + Math.cos(angle) * radius);
    const y = Math.round(175 + Math.sin(angle) * (radius * 0.72));
    const isSelected = selectedPlaceId === getPlaceId(p);
    const cat = "category" in p ? p.category : "ATTRACTION";

    return {
      place: p,
      x,
      y,
      isSelected,
      category: cat,
      name: p.name,
    };
  });

  return (
    <View style={styles.container}>
      {/* Editorial Cartographic Canvas Background */}
      <View style={styles.cartoCanvas}>
        {/* Subtle Waterway / River Curves */}
        <View style={styles.riverPath1} />
        <View style={styles.riverPath2} />

        {/* Parkland / Forest green tint */}
        <View style={styles.parkZone1} />
        <View style={styles.parkZone2} />

        {/* Road & Transit Grid lines */}
        <View style={styles.roadMain} />
        <View style={styles.roadCross} />
        <View style={styles.roadDiagonal} />

        {/* Neighborhood Labels on Map */}
        <Text style={[styles.neighborhoodLabel, { left: 45, top: 70 }]}>SHINJUKU</Text>
        <Text style={[styles.neighborhoodLabel, { right: 55, top: 85 }]}>ASAKUSA</Text>
        <Text style={[styles.neighborhoodLabel, { left: 60, bottom: 80 }]}>SHIBUYA</Text>
        <Text style={[styles.neighborhoodLabel, { right: 75, bottom: 65 }]}>GINZA</Text>
      </View>

      {/* Connected Itinerary Route Path */}
      {mappedPoints.map((pt, idx) => {
        if (idx === 0) return null;
        const prev = mappedPoints[idx - 1];
        const dx = pt.x - prev.x;
        const dy = pt.y - prev.y;
        const length = Math.hypot(dx, dy);
        const angle = Math.atan2(dy, dx) * (180 / Math.PI);

        return (
          <View
            key={`route-${idx}`}
            style={{
              position: "absolute",
              left: prev.x,
              top: prev.y,
              width: length,
              height: 2.5,
              backgroundColor: TRAVEL_THEME.colors.terracotta,
              opacity: 0.45,
              transformOrigin: "left center",
              transform: [{ rotate: `${angle}deg` }],
            }}
          >
            {/* Midpoint walking indicator */}
            <View
              style={{
                position: "absolute",
                left: length * 0.5 - 4,
                top: -3,
                width: 8,
                height: 8,
                borderRadius: 4,
                backgroundColor: "#FFFFFF",
                borderWidth: 1.5,
                borderColor: TRAVEL_THEME.colors.terracotta,
              }}
            />
          </View>
        );
      })}

      {/* User Current Location Dot */}
      <View style={[styles.userLocation, { left: 172, top: 168 }]}>
        <View style={styles.userPulse} />
        <View style={styles.userDot} />
      </View>

      {/* Hotel Base Anchor Pin */}
      <View style={[styles.hotelAnchor, { left: 140, top: 110 }]}>
        <View style={styles.hotelIconBubble}>
          <Ionicons name="bed" size={13} color="#FFFFFF" />
        </View>
        <View style={styles.hotelLabel}>
          <Text style={styles.hotelLabelText}>Hotel Base</Text>
        </View>
      </View>

      {/* Interactive Place Markers */}
      {mappedPoints.map((pt, idx) => {
        const id = getPlaceId(pt.place);
        const { iconName, pinBg } = getMarkerStyle(pt.category);

        return (
          <TouchableOpacity
            key={`pin-${id}-${idx}`}
            onPress={() => onSelectPlace(pt.place)}
            activeOpacity={0.85}
            style={[
              styles.pinContainer,
              { left: pt.x - 22, top: pt.y - 22 },
              pt.isSelected && styles.pinSelectedContainer,
            ]}
          >
            {/* Pin Bubble */}
            <View
              style={[
                styles.pinBubble,
                { backgroundColor: pt.isSelected ? TRAVEL_THEME.colors.inkPrimary : pinBg },
                pt.isSelected && styles.pinBubbleSelected,
              ]}
            >
              <Ionicons
                name={iconName as any}
                size={14}
                color="#FFFFFF"
              />
            </View>

            {/* Place Label Pill */}
            <View
              style={[
                styles.pinLabel,
                pt.isSelected && styles.pinLabelSelected,
              ]}
            >
              <Text
                style={[
                  styles.pinLabelText,
                  pt.isSelected && styles.pinLabelTextSelected,
                ]}
                numberOfLines={1}
              >
                {pt.name}
              </Text>
            </View>
          </TouchableOpacity>
        );
      })}

      {/* Top Floating Map Status / Info */}
      <View style={styles.mapBadge}>
        <Ionicons name="compass" size={13} color={TRAVEL_THEME.colors.terracotta} />
        <Text style={styles.mapBadgeText}>{cityName.toUpperCase()} · EXPLORATION SURFACE</Text>
      </View>
    </View>
  );
}

function getMarkerStyle(cat: string): { iconName: string; pinBg: string } {
  const norm = (cat || "").toUpperCase();
  if (norm.includes("FOOD") || norm.includes("RESTAURANT") || norm.includes("DINING")) {
    return { iconName: "restaurant", pinBg: TRAVEL_THEME.colors.amber };
  }
  if (norm.includes("CAFE") || norm.includes("COFFEE")) {
    return { iconName: "cafe", pinBg: TRAVEL_THEME.colors.amberDark };
  }
  if (norm.includes("HOTEL") || norm.includes("STAY")) {
    return { iconName: "bed", pinBg: TRAVEL_THEME.colors.ocean };
  }
  if (norm.includes("SHOP")) {
    return { iconName: "bag-handle", pinBg: TRAVEL_THEME.colors.terracotta };
  }
  if (norm.includes("PARK") || norm.includes("NATURE")) {
    return { iconName: "leaf", pinBg: TRAVEL_THEME.colors.forest };
  }
  return { iconName: "location", pinBg: TRAVEL_THEME.colors.terracotta };
}

const styles = StyleSheet.create({
  container: {
    height: 380,
    width: "100%",
    backgroundColor: "#F4EFE6", // Natural parchment terrain
    borderRadius: 24,
    overflow: "hidden",
    position: "relative",
    borderWidth: 1,
    borderColor: TRAVEL_THEME.colors.border,
    ...TRAVEL_THEME.shadows.card,
  },
  cartoCanvas: {
    ...StyleSheet.absoluteFillObject,
  },
  riverPath1: {
    position: "absolute",
    right: -30,
    top: 20,
    width: 140,
    height: 360,
    borderRadius: 90,
    borderWidth: 18,
    borderColor: "#DCE6EC", // River water blue
    opacity: 0.65,
    transform: [{ rotate: "-25deg" }],
  },
  riverPath2: {
    position: "absolute",
    left: 40,
    bottom: -60,
    width: 220,
    height: 100,
    borderRadius: 50,
    backgroundColor: "#DCE6EC",
    opacity: 0.4,
  },
  parkZone1: {
    position: "absolute",
    left: 30,
    top: 50,
    width: 90,
    height: 90,
    borderRadius: 45,
    backgroundColor: "#E4EDE7", // Park green
  },
  parkZone2: {
    position: "absolute",
    right: 40,
    bottom: 40,
    width: 110,
    height: 70,
    borderRadius: 35,
    backgroundColor: "#E4EDE7",
  },
  roadMain: {
    position: "absolute",
    left: 0,
    right: 0,
    top: 175,
    height: 4,
    backgroundColor: "#E9DFD2",
  },
  roadCross: {
    position: "absolute",
    top: 0,
    bottom: 0,
    left: 175,
    width: 4,
    backgroundColor: "#E9DFD2",
  },
  roadDiagonal: {
    position: "absolute",
    top: -50,
    left: 80,
    width: 3,
    height: 460,
    backgroundColor: "#EFE5D9",
    transform: [{ rotate: "35deg" }],
  },
  neighborhoodLabel: {
    position: "absolute",
    fontSize: 9.5,
    fontWeight: "700",
    letterSpacing: 1.5,
    color: "#B3A796",
  },
  userLocation: {
    position: "absolute",
    width: 22,
    height: 22,
    alignItems: "center",
    justifyContent: "center",
  },
  userPulse: {
    position: "absolute",
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: TRAVEL_THEME.colors.oceanLight,
    borderWidth: 1,
    borderColor: TRAVEL_THEME.colors.ocean,
    opacity: 0.6,
  },
  userDot: {
    width: 11,
    height: 11,
    borderRadius: 5.5,
    backgroundColor: TRAVEL_THEME.colors.ocean,
    borderWidth: 2,
    borderColor: "#FFFFFF",
  },
  hotelAnchor: {
    position: "absolute",
    alignItems: "center",
    zIndex: 8,
  },
  hotelIconBubble: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: TRAVEL_THEME.colors.ocean,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1.5,
    borderColor: "#FFFFFF",
    ...TRAVEL_THEME.shadows.card,
  },
  hotelLabel: {
    marginTop: 2,
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 5,
    paddingVertical: 1.5,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: TRAVEL_THEME.colors.border,
  },
  hotelLabelText: {
    fontSize: 9,
    fontWeight: "600",
    color: TRAVEL_THEME.colors.ocean,
  },
  pinContainer: {
    position: "absolute",
    alignItems: "center",
    width: 120,
    zIndex: 10,
  },
  pinSelectedContainer: {
    zIndex: 30,
  },
  pinBubble: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: "#FFFFFF",
    ...TRAVEL_THEME.shadows.card,
  },
  pinBubbleSelected: {
    transform: [{ scale: 1.15 }],
    borderColor: TRAVEL_THEME.colors.terracotta,
    borderWidth: 2.5,
  },
  pinLabel: {
    marginTop: 3,
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: TRAVEL_THEME.colors.border,
    maxWidth: 115,
    ...TRAVEL_THEME.shadows.card,
  },
  pinLabelSelected: {
    backgroundColor: TRAVEL_THEME.colors.inkPrimary,
    borderColor: TRAVEL_THEME.colors.inkPrimary,
  },
  pinLabelText: {
    fontSize: 10,
    fontWeight: "600",
    color: TRAVEL_THEME.colors.inkPrimary,
    textAlign: "center",
  },
  pinLabelTextSelected: {
    color: "#FFFFFF",
  },
  mapBadge: {
    position: "absolute",
    top: 12,
    left: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 9,
    paddingVertical: 4.5,
    borderRadius: 12,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: TRAVEL_THEME.colors.border,
    ...TRAVEL_THEME.shadows.card,
  },
  mapBadgeText: {
    fontSize: 9.5,
    fontWeight: "700",
    letterSpacing: 0.8,
    color: TRAVEL_THEME.colors.inkSecondary,
  },
});

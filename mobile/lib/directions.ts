import { Linking, Platform } from "react-native";

/**
 * Hand off to the system maps app for turn-by-turn directions. Apple Maps on
 * iOS, Google Maps (app or web) elsewhere. Falls back to a text search when a
 * stop has no coordinates.
 */
export function openDirections(opts: { lat?: number | null; lng?: number | null; name: string; city?: string }) {
  const { lat, lng, name, city } = opts;
  const hasCoords = typeof lat === "number" && typeof lng === "number" && !(lat === 0 && lng === 0);
  const query = encodeURIComponent([name, city].filter(Boolean).join(", "));
  let url: string;
  if (Platform.OS === "ios") {
    url = hasCoords ? `http://maps.apple.com/?daddr=${lat},${lng}&q=${encodeURIComponent(name)}` : `http://maps.apple.com/?q=${query}`;
  } else {
    url = hasCoords
      ? `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`
      : `https://www.google.com/maps/search/?api=1&query=${query}`;
  }
  return Linking.openURL(url);
}

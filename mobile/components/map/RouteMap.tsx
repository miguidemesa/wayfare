import { useEffect, useMemo, useRef, useState } from "react";
import { View, type StyleProp, type ViewStyle } from "react-native";
import { WebView, type WebViewMessageEvent } from "react-native-webview";
import { useTheme } from "@/shared/theme";
import { mapHtml, type MapData } from "./mapHtml";

export type RouteMapProps = {
  data: MapData;
  /** Changes whenever `data` does (e.g. day id + stop ids). Triggers a redraw. */
  dataKey: string;
  selectedId: string | null;
  onSelect: (id: string) => void;
  onError: () => void;
  /** Draw the dashed line through the stops in order (itinerary) — off for loose places. */
  showRoute?: boolean;
  style?: StyleProp<ViewStyle>;
};

/** Native: Leaflet inside a WebView. The page is built once per theme. */
export function RouteMap({ data, dataKey, selectedId, onSelect, onError, style, showRoute = true }: RouteMapProps) {
  const { colors, dark } = useTheme();
  const ref = useRef<WebView>(null);
  const [ready, setReady] = useState(false);
  const html = useMemo(
    () => mapHtml({ paper: colors.paper, ink: colors.ink, accent: colors.accent, onInk: colors.onInk, rule: colors.rule }, dark),
    // Rebuilding the page resets the camera — only do it when the theme flips.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [dark]
  );

  // If Leaflet never comes up (offline, CDN blocked), say so instead of
  // showing a blank rectangle forever.
  const errorRef = useRef(onError);
  errorRef.current = onError;
  useEffect(() => {
    if (ready) return;
    const t = setTimeout(() => errorRef.current(), 15000);
    return () => clearTimeout(t);
  }, [ready, html]);

  const latest = useRef({ data, selectedId, showRoute });
  latest.current = { data, selectedId, showRoute };
  const send = (msg: object) =>
    ref.current?.injectJavaScript(`window.__wayfare && window.__wayfare(${JSON.stringify(msg)}); true;`);

  useEffect(() => {
    if (ready) send({ type: "render", ...latest.current.data, selectedId: latest.current.selectedId, showRoute: latest.current.showRoute });
  }, [ready, dataKey]);

  useEffect(() => {
    if (ready) send({ type: "select", id: selectedId });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId]);

  function onMessage(e: WebViewMessageEvent) {
    try {
      const msg = JSON.parse(e.nativeEvent.data);
      if (msg.type === "ready") setReady(true);
      else if (msg.type === "select" && msg.id) onSelect(msg.id);
      else if (msg.type === "error") onError();
    } catch {
      // Ignore anything that isn't ours.
    }
  }

  return (
    <View style={[{ backgroundColor: colors.paper, overflow: "hidden" }, style]}>
      <WebView
        ref={ref}
        source={{ html, baseUrl: "https://wayfare.app" }}
        originWhitelist={["*"]}
        onMessage={onMessage}
        onError={onError}
        onHttpError={() => {}}
        javaScriptEnabled
        scrollEnabled={false}
        bounces={false}
        overScrollMode="never"
        setSupportMultipleWindows={false}
        style={{ flex: 1, backgroundColor: colors.paper }}
        containerStyle={{ backgroundColor: colors.paper }}
        accessibilityLabel="Map of this day's stops"
      />
    </View>
  );
}

import { createElement, useEffect, useMemo, useRef, useState } from "react";
import { View } from "react-native";
import { useTheme } from "@/shared/theme";
import { mapHtml } from "./mapHtml";
import type { RouteMapProps } from "./RouteMap";

/** Web: the same Leaflet page in a sandboxed iframe, talking over postMessage. */
export function RouteMap({ data, dataKey, selectedId, onSelect, onError, style, showRoute = true }: RouteMapProps) {
  const { colors, dark } = useTheme();
  const frame = useRef<HTMLIFrameElement | null>(null);
  const [ready, setReady] = useState(false);
  const html = useMemo(
    () => mapHtml({ paper: colors.paper, ink: colors.ink, accent: colors.accent, onInk: colors.onInk, rule: colors.rule }, dark),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [dark]
  );

  const handlers = useRef({ onSelect, onError });
  handlers.current = { onSelect, onError };

  useEffect(() => {
    setReady(false);
    function listen(e: MessageEvent) {
      if (e.source !== frame.current?.contentWindow || !e.data?.__wayfareMap) return;
      if (e.data.type === "ready") setReady(true);
      else if (e.data.type === "select" && e.data.id) handlers.current.onSelect(e.data.id);
      else if (e.data.type === "error") handlers.current.onError();
    }
    window.addEventListener("message", listen);
    return () => window.removeEventListener("message", listen);
  }, [html]);

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
  const send = (msg: object) => frame.current?.contentWindow?.postMessage(msg, "*");

  useEffect(() => {
    if (ready) send({ type: "render", ...latest.current.data, selectedId: latest.current.selectedId, showRoute: latest.current.showRoute });
  }, [ready, dataKey]);

  useEffect(() => {
    if (ready) send({ type: "select", id: selectedId });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId]);

  return (
    <View style={[{ backgroundColor: colors.paper, overflow: "hidden" }, style]}>
      {createElement("iframe", {
        ref: frame,
        srcDoc: html,
        title: "Map of this day's stops",
        sandbox: "allow-scripts",
        style: { border: 0, width: "100%", height: "100%", display: "block", background: colors.paper },
      })}
    </View>
  );
}

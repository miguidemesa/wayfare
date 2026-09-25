// The itinerary map runs as a small MapLibre page (inside a WebView on native,
// an iframe on web). No API key and no usage cap: vector tiles and styles come
// from OpenFreeMap (OpenStreetMap data), attributed on the map.
//
// Protocol — host → page: { type: "render", stops, anchors, center, selectedId }
//                         { type: "select", id }
//            page → host: { type: "ready" } | { type: "select", id } | { type: "error" }

export type MapStop = { id: string; n: number; lat: number; lng: number; title: string; time?: string };
export type MapAnchor = { id: string; lat: number; lng: number; title: string };
export type MapData = {
  stops: MapStop[];
  anchors: MapAnchor[];
  /** Where to look when there's nothing to show. */
  center: { lat: number; lng: number } | null;
};

export type MapPalette = { paper: string; ink: string; accent: string; onInk: string; rule: string };

const MAPLIBRE = "https://cdn.jsdelivr.net/npm/maplibre-gl@4.7.1/dist";

export function mapHtml(p: MapPalette, dark: boolean): string {
  const style = `https://tiles.openfreemap.org/styles/${dark ? "dark" : "positron"}`;
  return `<!doctype html><html><head>
<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no">
<link rel="stylesheet" href="${MAPLIBRE}/maplibre-gl.css">
<style>
html,body,#m{margin:0;height:100%;background:${p.paper}}
.pin{display:flex;align-items:center;justify-content:center;border-radius:50%;background:${p.ink};color:${p.onInk};
 font:600 12px/1 -apple-system,system-ui,sans-serif;border:2px solid ${p.paper};box-shadow:0 1px 3px rgba(0,0,0,.25);
 width:22px;height:22px;cursor:pointer;transition:transform .18s ease-out, background-color .18s ease-out}
.pin.on{background:${p.accent};transform:scale(1.3)}
.anchor{display:flex;align-items:center;justify-content:center;width:20px;height:20px;border-radius:4px;background:${p.paper};
 color:${p.ink};border:1.5px solid ${p.ink};font:700 11px/1 -apple-system,system-ui,sans-serif}
.maplibregl-ctrl-attrib{font-size:9px}
${dark ? "" : ".maplibregl-canvas{filter:sepia(.18) saturate(.9)}"}
</style></head><body><div id="m"></div>
<script>
(function(){
  function send(msg){
    if (window.ReactNativeWebView) window.ReactNativeWebView.postMessage(JSON.stringify(msg));
    else if (window.parent !== window) window.parent.postMessage(Object.assign({__wayfareMap:true}, msg), "*");
  }
  var s = document.createElement("script");
  s.src = "${MAPLIBRE}/maplibre-gl.js";
  s.onerror = function(){ send({type:"error"}); };
  s.onload = boot;
  document.head.appendChild(s);

  var reduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var map, markers = {}, others = [], state = null, pending = null, loaded = false;

  function boot(){
    try {
      map = new maplibregl.Map({ container:"m", style:"${style}", center:[0,20], zoom:1.5,
        attributionControl:{compact:true}, dragRotate:false, pitchWithRotate:false });
    } catch (e) { send({type:"error"}); return; }
    map.touchZoomRotate.disableRotation();
    map.on("error", function(e){ if (!loaded) send({type:"error"}); });
    map.on("load", function(){
      loaded = true;
      map.addSource("route", {type:"geojson", data:{type:"FeatureCollection", features:[]}});
      map.addLayer({id:"route", type:"line", source:"route",
        layout:{"line-cap":"round","line-join":"round"},
        paint:{"line-color":"${p.ink}","line-width":2,"line-opacity":.6,"line-dasharray":[1.5,2.5]}});
      if (pending) { render(pending); pending = null; }
    });
    window.addEventListener("message", function(e){ handle(e.data); });
    document.addEventListener("message", function(e){ handle(e.data); });
    window.__wayfare = handle;
    send({type:"ready"});
  }

  function handle(raw){
    var msg = raw;
    if (typeof raw === "string") { try { msg = JSON.parse(raw); } catch(e) { return; } }
    if (!msg || !map) return;
    if (msg.type === "render") { if (loaded) render(msg); else pending = msg; }
    else if (msg.type === "select") select(msg.id, true);
  }

  function clear(){
    Object.keys(markers).forEach(function(k){ markers[k].m.remove(); });
    others.forEach(function(m){ m.remove(); });
    markers = {}; others = [];
  }

  function render(next){
    state = next;
    clear();
    var pts = [];
    next.anchors.forEach(function(a){
      var el = document.createElement("div"); el.className = "anchor"; el.textContent = "H"; el.title = a.title;
      others.push(new maplibregl.Marker({element:el}).setLngLat([a.lng,a.lat]).addTo(map));
      pts.push([a.lng,a.lat]);
    });
    map.getSource("route").setData({type:"Feature", geometry:{type:"LineString",
      coordinates: next.showRoute === false ? [] : next.stops.map(function(s){ return [s.lng,s.lat]; })}});
    next.stops.forEach(function(s){
      var el = document.createElement("div");
      el.className = "pin" + (s.id === next.selectedId ? " on" : "");
      el.textContent = s.n; el.title = s.title;
      el.addEventListener("click", function(ev){ ev.stopPropagation(); select(s.id, false); send({type:"select", id:s.id}); });
      var m = new maplibregl.Marker({element:el}).setLngLat([s.lng,s.lat]).addTo(map);
      markers[s.id] = {m:m, el:el, s:s};
      pts.push([s.lng,s.lat]);
    });
    if (next.selectedId && markers[next.selectedId]) focus(next.selectedId, true);
    else frame(pts, true);
    if (!pts.length && next.center) map.jumpTo({center:[next.center.lng,next.center.lat], zoom:11});
  }

  function frame(pts, instant){
    if (pts.length > 1) {
      var b = pts.reduce(function(b,p){ return b.extend(p); }, new maplibregl.LngLatBounds(pts[0], pts[0]));
      map.fitBounds(b, {padding:48, maxZoom:15, duration: instant || reduce ? 0 : 450});
    } else if (pts.length === 1) {
      if (instant || reduce) map.jumpTo({center:pts[0], zoom:15}); else map.easeTo({center:pts[0], zoom:15, duration:450});
    }
  }

  function select(id, pan){
    if (!state) return;
    state.selectedId = id;
    Object.keys(markers).forEach(function(k){
      markers[k].el.className = "pin" + (k === id ? " on" : "");
      markers[k].el.style.zIndex = k === id ? "2" : "1";
    });
    if (!id) { frame(Object.keys(markers).map(function(k){ return [markers[k].s.lng, markers[k].s.lat]; }), false); return; }
    if (pan && markers[id]) focus(id, false);
  }

  function focus(id, instant){
    var s = markers[id].s;
    var z = Math.max(map.getZoom(), 15);
    if (reduce || instant) map.jumpTo({center:[s.lng,s.lat], zoom:z});
    else map.easeTo({center:[s.lng,s.lat], zoom:z, duration:450});
  }
})();
</script></body></html>`;
}

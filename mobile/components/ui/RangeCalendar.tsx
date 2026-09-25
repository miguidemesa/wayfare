import { useState } from "react";
import { Pressable, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { radii, useTheme } from "@/shared/theme";
import { T } from "./T";

const WEEKDAYS = ["M", "T", "W", "T", "F", "S", "S"];

function key(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/**
 * Month grid for picking a trip's first and last day. First tap sets the
 * start, second the end (tapping before the start restarts the range).
 * Values are local YYYY-MM-DD strings.
 */
export function RangeCalendar({
  start,
  end,
  onChange,
}: {
  start: string | null;
  end: string | null;
  onChange: (start: string | null, end: string | null) => void;
}) {
  const { colors } = useTheme();
  const initial = start ? new Date(start + "T00:00:00") : new Date();
  const [month, setMonth] = useState(new Date(initial.getFullYear(), initial.getMonth(), 1));
  const today = key(new Date());

  const first = new Date(month.getFullYear(), month.getMonth(), 1);
  const lead = (first.getDay() + 6) % 7; // Monday-first
  const daysIn = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
  const cells: (Date | null)[] = [...Array(lead).fill(null), ...Array.from({ length: daysIn }, (_, i) => new Date(month.getFullYear(), month.getMonth(), i + 1))];
  while (cells.length % 7) cells.push(null);

  function tap(k: string) {
    if (!start || (start && end) || k < start) onChange(k, null);
    else onChange(start, k);
  }

  const label = month.toLocaleDateString("en-US", { month: "long", year: "numeric" });

  return (
    <View>
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
        <Pressable onPress={() => setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))} accessibilityRole="button" accessibilityLabel="Previous month" hitSlop={10} style={{ padding: 6 }}>
          <Ionicons name="chevron-back" size={18} color={colors.ink} />
        </Pressable>
        <T v="bodyStrong">{label}</T>
        <Pressable onPress={() => setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))} accessibilityRole="button" accessibilityLabel="Next month" hitSlop={10} style={{ padding: 6 }}>
          <Ionicons name="chevron-forward" size={18} color={colors.ink} />
        </Pressable>
      </View>
      <View style={{ flexDirection: "row" }}>
        {WEEKDAYS.map((w, i) => (
          <View key={i} style={{ flex: 1, alignItems: "center", paddingVertical: 4 }}>
            <T v="small" c="ink3">
              {w}
            </T>
          </View>
        ))}
      </View>
      {Array.from({ length: cells.length / 7 }, (_, row) => (
        <View key={row} style={{ flexDirection: "row" }}>
          {cells.slice(row * 7, row * 7 + 7).map((d, i) => {
            if (!d) return <View key={i} style={{ flex: 1, height: 42 }} />;
            const k = key(d);
            const isEdge = k === start || k === end;
            const inRange = start && end && k > start && k < end;
            const past = k < today;
            return (
              <Pressable
                key={i}
                onPress={() => tap(k)}
                accessibilityRole="button"
                aria-selected={isEdge || !!inRange}
                accessibilityLabel={d.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}
                style={{ flex: 1, height: 42, alignItems: "center", justifyContent: "center", backgroundColor: inRange ? colors.accentSoft : "transparent" }}
              >
                <View
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: radii.sm,
                    alignItems: "center",
                    justifyContent: "center",
                    backgroundColor: isEdge ? colors.ink : "transparent",
                    borderWidth: k === today && !isEdge ? 1 : 0,
                    borderColor: colors.edge,
                  }}
                >
                  <T v="meta" num style={{ color: isEdge ? colors.onInk : past ? colors.ink3 : colors.ink }}>
                    {d.getDate()}
                  </T>
                </View>
              </Pressable>
            );
          })}
        </View>
      ))}
    </View>
  );
}

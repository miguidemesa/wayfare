import { Pressable, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { radii, useTheme } from "@/shared/theme";
import { T } from "./T";

/** A labelled whole number with − and + (travellers, a child's age…). */
export function Counter({
  label,
  detail,
  value,
  min = 0,
  max = 20,
  onChange,
  format = String,
}: {
  label: string;
  detail?: string;
  value: number;
  min?: number;
  max?: number;
  onChange: (n: number) => void;
  format?: (n: number) => string;
}) {
  return (
    <View
      style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 }}
      accessible
      accessibilityRole="adjustable"
      accessibilityLabel={label}
      accessibilityValue={{ text: format(value) }}
      accessibilityActions={[{ name: "increment" }, { name: "decrement" }]}
      onAccessibilityAction={(e) => {
        if (e.nativeEvent.actionName === "increment" && value < max) onChange(value + 1);
        if (e.nativeEvent.actionName === "decrement" && value > min) onChange(value - 1);
      }}
    >
      <View style={{ flex: 1 }}>
        <T v="bodyStrong">{label}</T>
        {detail ? (
          <T v="small" c="ink3">
            {detail}
          </T>
        ) : null}
      </View>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
        <StepButton icon="remove" disabled={value <= min} onPress={() => onChange(value - 1)} />
        <T v="heading" num style={{ minWidth: 32, textAlign: "center" }}>
          {format(value)}
        </T>
        <StepButton icon="add" disabled={value >= max} onPress={() => onChange(value + 1)} />
      </View>
    </View>
  );
}

function StepButton({ icon, disabled, onPress }: { icon: "add" | "remove"; disabled: boolean; onPress: () => void }) {
  const { colors } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      // The row is the accessible control; these are its touch targets.
      importantForAccessibility="no"
      accessibilityElementsHidden
      style={({ pressed }) => ({
        width: 44,
        height: 44,
        borderRadius: radii.md,
        borderWidth: 1,
        borderColor: colors.edge,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: pressed ? colors.sunk : colors.raised,
        opacity: disabled ? 0.35 : 1,
      })}
    >
      <Ionicons name={icon} size={20} color={colors.ink} />
    </Pressable>
  );
}

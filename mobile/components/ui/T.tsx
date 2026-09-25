import { Text, type TextProps } from "react-native";
import { TABULAR_NUMS, type, useTheme, type ThemeColors, type TypeVariant } from "@/shared/theme";

type Props = TextProps & {
  v?: TypeVariant;
  c?: keyof ThemeColors;
  /** Tabular figures — for times, money and counts that line up. */
  num?: boolean;
  center?: boolean;
};

/** The one text primitive. Every string in the app goes through a type variant. */
export function T({ v = "body", c = "ink", num, center, style, ...rest }: Props) {
  const { colors } = useTheme();
  return (
    <Text
      {...rest}
      style={[type[v], { color: colors[c] }, num && TABULAR_NUMS, center && { textAlign: "center" }, style]}
    />
  );
}

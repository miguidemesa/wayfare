import { useEffect, useState } from "react";
import { Pressable, TextInput, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { fmtMoney, fonts, GUTTER, radii, space, TABULAR_NUMS, useTheme } from "@/shared/theme";
import { convert, localCurrency } from "@/shared/trip";
import { SUPPORTED_CURRENCIES } from "@/shared/types";
import { useTrip } from "@/lib/trip";
import { SubScreen } from "@/components/trip/SubScreen";
import { Choices, Rule } from "@/components/ui/Primitives";
import { T } from "@/components/ui/T";

export { ErrorFallback as ErrorBoundary } from "@/components/ErrorFallback";

const QUICK = [100, 500, 1000, 5000, 10000];

export default function Currency() {
  const { colors } = useTheme();
  const { bundle, rates, ensureRates } = useTrip();
  const home = bundle?.trip.homeCurrency ?? "USD";
  const local = bundle ? localCurrency(bundle) : "USD";
  const [from, setFrom] = useState(local);
  const [to, setTo] = useState(home === local ? "USD" : home);
  const [amount, setAmount] = useState("1000");
  const [picking, setPicking] = useState<"from" | "to" | null>(null);

  useEffect(() => {
    void ensureRates();
  }, [ensureRates]);

  const value = Number(amount.replace(/,/g, "")) || 0;
  const r = rates?.rates;
  const out = r ? convert(value, from, to, r) : null;
  const unit = r ? convert(1, from, to, r) : null;
  const options = Array.from(new Set([local, home, ...SUPPORTED_CURRENCIES])).map((c) => ({ key: c, label: c }));

  return (
    <SubScreen
      title="Currency"
      intro={
        rates
          ? rates.source === "live"
            ? `Live rates, updated ${new Date(rates.updatedAt).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}`
            : rates.source === "cached"
              ? `Saved rates from ${new Date(rates.updatedAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })} — live rates unavailable`
              : "Reference rates — live rates unavailable right now"
          : "Loading rates…"
      }
    >
      <View style={{ paddingHorizontal: GUTTER, gap: space.lg }}>
        <View>
          <Pressable onPress={() => setPicking(picking === "from" ? null : "from")} accessibilityRole="button" accessibilityLabel={`Converting from ${from}. Change`}>
            <T v="label" c="accent">
              {from} ▾
            </T>
          </Pressable>
          <TextInput
            value={amount}
            onChangeText={(t) => setAmount(t.replace(/[^0-9.,]/g, ""))}
            keyboardType="decimal-pad"
            selectionColor={colors.accent}
            accessibilityLabel={`Amount in ${from}`}
            style={[{ fontFamily: fonts.serifMedium, fontSize: 44, lineHeight: 52, color: colors.ink, padding: 0, marginTop: 4 }, TABULAR_NUMS]}
          />
          <Rule strong />
        </View>
        {picking === "from" ? <Choices options={options} value={from} onChange={(c) => { setFrom(c); setPicking(null); }} /> : null}

        <Pressable
          onPress={() => {
            setFrom(to);
            setTo(from);
          }}
          accessibilityRole="button"
          accessibilityLabel="Swap currencies"
          style={({ pressed }) => ({ alignSelf: "flex-start", flexDirection: "row", gap: 6, alignItems: "center", paddingVertical: 6, paddingHorizontal: 10, borderRadius: radii.sm, borderWidth: 1, borderColor: colors.rule, opacity: pressed ? 0.6 : 1 })}
        >
          <Ionicons name="swap-vertical" size={16} color={colors.ink} />
          <T v="meta">Swap</T>
        </Pressable>

        <View>
          <Pressable onPress={() => setPicking(picking === "to" ? null : "to")} accessibilityRole="button" accessibilityLabel={`Converting to ${to}. Change`}>
            <T v="label" c="accent">
              {to} ▾
            </T>
          </Pressable>
          <T v="figure" num style={{ marginTop: 4 }} accessibilityLiveRegion="polite">
            {out != null ? fmtMoney(Math.round(out * 100) / 100, to) : "—"}
          </T>
          {unit != null ? (
            <T v="meta" c="ink3" num>
              1 {from} = {unit < 0.01 ? unit.toFixed(5) : unit.toFixed(unit < 1 ? 4 : 2)} {to}
            </T>
          ) : null}
        </View>
        {picking === "to" ? <Choices options={options} value={to} onChange={(c) => { setTo(c); setPicking(null); }} /> : null}

        {r ? (
          <View style={{ marginTop: space.lg }}>
            <T v="label" c="ink3" style={{ marginBottom: space.sm }}>
              At a glance
            </T>
            {QUICK.map((q) => (
              <View key={q} style={{ flexDirection: "row", justifyContent: "space-between", paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: colors.rule }}>
                <T v="meta" num>
                  {fmtMoney(q, from)}
                </T>
                <T v="meta" c="ink2" num>
                  {fmtMoney(Math.round(convert(q, from, to, r) * 100) / 100, to)}
                </T>
              </View>
            ))}
          </View>
        ) : null}
      </View>
    </SubScreen>
  );
}

import { useState } from "react";
import {
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "@/lib/auth";
import { ApiError } from "@/shared/api";
import { TRAVEL_THEME } from "@/shared/theme";
import { Card } from "@/components/ui/Surface";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { Button } from "@/components/ui/Button";

export default function Login() {
  const { signIn, signUp } = useAuth();
  const insets = useSafeAreaInsets();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("demo@wayfare.app");
  const [password, setPassword] = useState("wanderlust");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      if (mode === "login") {
        await signIn(email.trim(), password);
      } else {
        await signUp(email.trim(), password, name.trim() || undefined);
      }
      router.replace("/trips");
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Authentication failed. Please check your credentials.");
    } finally {
      setBusy(false);
    }
  }

  function fillDemo() {
    setEmail("demo@wayfare.app");
    setPassword("wanderlust");
    setMode("login");
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      style={[
        styles.container,
        { paddingTop: insets.top, paddingBottom: insets.bottom },
      ]}
    >
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Brand & Editorial Headline */}
        <View style={styles.heroSection}>
          <View style={styles.brandRow}>
            <View style={styles.brandIconBubble}>
              <Ionicons name="compass" size={16} color={TRAVEL_THEME.colors.terracotta} />
            </View>
            <Text style={styles.brandText}>WAYFARE</Text>
          </View>

          <Text style={styles.editorialTitle}>
            Where will you{"\n"}wander next?
          </Text>
          <Text style={styles.editorialSubtitle}>
            Your entire trip in one calm, beautifully organized companion. Itineraries, maps, live currency, and local intelligence.
          </Text>
        </View>

        {/* Auth Card */}
        <Card padding={22} style={styles.authCard}>
          {/* Mode Switcher */}
          <SegmentedControl
            options={[
              { key: "login", label: "Sign In" },
              { key: "register", label: "Create Account" },
            ]}
            value={mode}
            onChange={(val) => {
              setMode(val);
              setError(null);
            }}
            accentColor={TRAVEL_THEME.colors.terracotta}
          />

          <View style={styles.formFields}>
            {mode === "register" && (
              <View>
                <Text style={styles.fieldLabel}>FULL NAME</Text>
                <TextInput
                  value={name}
                  onChangeText={setName}
                  placeholder="e.g. Maya Chen"
                  placeholderTextColor={TRAVEL_THEME.colors.inkDim}
                  autoCapitalize="words"
                  style={styles.input}
                />
              </View>
            )}

            <View>
              <Text style={styles.fieldLabel}>EMAIL ADDRESS</Text>
              <TextInput
                value={email}
                onChangeText={setEmail}
                placeholder="name@example.com"
                placeholderTextColor={TRAVEL_THEME.colors.inkDim}
                autoCapitalize="none"
                keyboardType="email-address"
                style={styles.input}
              />
            </View>

            <View>
              <Text style={styles.fieldLabel}>PASSWORD</Text>
              <TextInput
                value={password}
                onChangeText={setPassword}
                placeholder="Min. 8 characters"
                placeholderTextColor={TRAVEL_THEME.colors.inkDim}
                secureTextEntry
                style={styles.input}
              />
            </View>

            {error ? (
              <View style={styles.errorBox}>
                <Ionicons name="alert-circle" size={14} color={TRAVEL_THEME.colors.danger} />
                <Text style={styles.errorText}>{error}</Text>
              </View>
            ) : null}

            <Button
              label={mode === "login" ? "Sign In to Wayfare" : "Create My Account"}
              variant="primary"
              size="lg"
              loading={busy}
              onPress={submit}
              style={{ marginTop: 6 }}
            />

            <Button
              label="Explore Demo Account (demo@wayfare.app)"
              variant="secondary"
              size="md"
              onPress={fillDemo}
              iconLeft={<Ionicons name="flash-outline" size={15} color={TRAVEL_THEME.colors.terracotta} />}
              style={{ marginTop: 2 }}
            />
          </View>
        </Card>

        {/* Footer info */}
        <View style={styles.footer}>
          <Text style={styles.footerText}>
            Wayfare Travel OS · Designed for exploration & calm
          </Text>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: TRAVEL_THEME.colors.bg,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: "center",
    paddingHorizontal: 20,
    paddingVertical: 24,
  },
  heroSection: {
    marginBottom: 20,
  },
  brandRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    marginBottom: 10,
  },
  brandIconBubble: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: TRAVEL_THEME.colors.terracottaLight,
    alignItems: "center",
    justifyContent: "center",
  },
  brandText: {
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 2,
    color: TRAVEL_THEME.colors.terracotta,
  },
  editorialTitle: {
    fontFamily: "Georgia",
    fontSize: 34,
    fontWeight: "700",
    lineHeight: 40,
    color: TRAVEL_THEME.colors.inkPrimary,
    letterSpacing: -0.4,
  },
  editorialSubtitle: {
    marginTop: 8,
    fontSize: 13.5,
    lineHeight: 20,
    color: TRAVEL_THEME.colors.inkSecondary,
    maxWidth: 340,
  },
  authCard: {
    backgroundColor: TRAVEL_THEME.colors.surface,
    borderColor: TRAVEL_THEME.colors.border,
    ...TRAVEL_THEME.shadows.card,
  },
  formFields: {
    marginTop: 18,
    gap: 12,
  },
  fieldLabel: {
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 0.8,
    color: TRAVEL_THEME.colors.inkMuted,
    marginBottom: 5,
  },
  input: {
    backgroundColor: TRAVEL_THEME.colors.surfaceWarm,
    borderWidth: 1,
    borderColor: TRAVEL_THEME.colors.border,
    borderRadius: TRAVEL_THEME.radii.md,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 14,
    color: TRAVEL_THEME.colors.inkPrimary,
  },
  errorBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: TRAVEL_THEME.colors.dangerLight,
    borderWidth: 1,
    borderColor: "#F4D2CE",
  },
  errorText: {
    fontSize: 12,
    color: TRAVEL_THEME.colors.danger,
    flex: 1,
  },
  footer: {
    marginTop: 24,
    alignItems: "center",
  },
  footerText: {
    fontSize: 11.5,
    fontWeight: "500",
    color: TRAVEL_THEME.colors.inkDim,
  },
});
import { useRef, useState } from "react";
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ApiError } from "@/shared/api";
import { GUTTER, space, useTheme } from "@/shared/theme";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Primitives";
import { T } from "@/components/ui/T";

export { ErrorFallback as ErrorBoundary } from "@/components/ErrorFallback";

// The demo account's password is in the bundle, so offer it only in
// development and in builds made for showing the app off.
const SHOW_DEMO = __DEV__ || process.env.EXPO_PUBLIC_SHOW_DEMO_LOGIN === "1";

// Signing in flips the auth guard in the root layout, which moves the user on
// to their trips — this screen never navigates by itself.
export default function Login() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { signIn, signUp, notice } = useAuth();
  const [mode, setMode] = useState<"signin" | "register">("signin");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const passwordRef = useRef<TextInput>(null);
  const emailRef = useRef<TextInput>(null);

  async function submit() {
    if (busy) return;
    if (!email.trim() || !password) {
      setError("Enter your email and password.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      if (mode === "signin") await signIn(email.trim(), password);
      else await signUp(email.trim(), password, name.trim() || undefined);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "That didn't work. Check your details and try again.");
      setBusy(false);
    }
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: colors.paper }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <ScrollView
        contentContainerStyle={{ flexGrow: 1, paddingHorizontal: GUTTER, paddingTop: insets.top + space.xxxl, paddingBottom: insets.bottom + space.xl }}
        keyboardShouldPersistTaps="handled"
      >
        <T v="entry">Wayfare</T>
        <T v="display" style={{ marginTop: space.xxl, maxWidth: 360 }}>
          Your trip, day by day.
        </T>
        <T v="body" c="ink2" style={{ marginTop: space.md, maxWidth: 360 }}>
          Plan each day, see it on the map, and keep track of what you spend — in any currency.
        </T>

        <View style={{ marginTop: space.xxl, gap: space.lg, maxWidth: 440 }}>
          {notice && !error ? (
            <T v="meta" c="caution" accessibilityLiveRegion="polite">
              {notice}
            </T>
          ) : null}
          {mode === "register" ? (
            <Field label="Name" value={name} onChangeText={setName} placeholder="What should we call you?" autoComplete="name" returnKeyType="next" onSubmitEditing={() => emailRef.current?.focus()} />
          ) : null}
          <Field
            ref={emailRef}
            label="Email"
            value={email}
            onChangeText={setEmail}
            placeholder="you@example.com"
            autoCapitalize="none"
            autoComplete="email"
            keyboardType="email-address"
            textContentType="emailAddress"
            returnKeyType="next"
            onSubmitEditing={() => passwordRef.current?.focus()}
          />
          <Field
            ref={passwordRef}
            label="Password"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            autoComplete={mode === "signin" ? "current-password" : "new-password"}
            textContentType={mode === "signin" ? "password" : "newPassword"}
            returnKeyType="go"
            onSubmitEditing={submit}
          />
          {error ? (
            <T v="meta" c="danger" accessibilityLiveRegion="polite">
              {error}
            </T>
          ) : null}
          <Button size="lg" label={mode === "signin" ? "Sign in" : "Create account"} loading={busy} onPress={submit} />
          <Pressable
            onPress={() => {
              setMode(mode === "signin" ? "register" : "signin");
              setError(null);
            }}
            accessibilityRole="button"
            hitSlop={8}
            style={{ alignSelf: "flex-start" }}
          >
            <T v="meta" c="ink2">
              {mode === "signin" ? "New here? " : "Have an account? "}
              <T v="meta" c="accent">
                {mode === "signin" ? "Create an account" : "Sign in"}
              </T>
            </T>
          </Pressable>
        </View>

        <View style={{ flex: 1 }} />
        {SHOW_DEMO ? (
          <Pressable
            onPress={() => {
              setMode("signin");
              setEmail("demo@wayfare.app");
              setPassword("wanderlust");
            }}
            accessibilityRole="button"
            hitSlop={8}
            style={{ marginTop: space.xxl, alignSelf: "flex-start" }}
          >
            <T v="small" c="ink3">
              Just looking? Fill in the demo account
            </T>
          </Pressable>
        ) : null}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

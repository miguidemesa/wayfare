import { useEffect, useRef, useState } from "react";
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated, { FadeIn, ReduceMotion, useAnimatedStyle, useSharedValue, withDelay, withTiming } from "react-native-reanimated";
import { Ionicons } from "@expo/vector-icons";
import { ApiError } from "@/shared/api";
import { GUTTER, motion, space, useTheme } from "@/shared/theme";
import { useAuth } from "@/lib/auth";
import { enterFrom, enterUp, fadeIn, fadeOut, reflow, settle } from "@/lib/motion";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Primitives";
import { T } from "@/components/ui/T";

export { ErrorFallback as ErrorBoundary } from "@/components/ErrorFallback";

// The demo account's password is in the bundle, so offer it only in
// development and in builds made for showing the app off.
const SHOW_DEMO = __DEV__ || process.env.EXPO_PUBLIC_SHOW_DEMO_LOGIN === "1";

type Step = "welcome" | "signin" | "register";

// The signed-out landing: what Wayfare is, drawn as a route, then a way in.
// Signing in flips the auth guard in the root layout, which moves the user on
// to their trips — this screen never navigates by itself.
export default function Login() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { signIn, signUp, notice } = useAuth();
  // A session that ended on its own goes straight back to signing in.
  const [step, setStep] = useState<Step>(notice ? "signin" : "welcome");
  // Which way the last move went; null until the first, so the landing just arrives.
  const [dir, setDir] = useState<1 | -1 | null>(null);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const passwordRef = useRef<TextInput>(null);
  const emailRef = useRef<TextInput>(null);
  const register = step === "register";

  useEffect(() => {
    if (notice) setStep("signin");
  }, [notice]);

  function go(next: Step) {
    setDir(next === "welcome" ? -1 : 1);
    setStep(next);
    setError(null);
  }

  async function submit() {
    if (busy) return;
    if (!email.trim() || !password) {
      setError("Enter your email and password.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      if (register) await signUp(email.trim(), password, name.trim() || undefined);
      else await signIn(email.trim(), password);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "That didn't work. Check your details and try again.");
      setBusy(false);
    }
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: colors.paper }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <ScrollView
        contentContainerStyle={{ flexGrow: 1, paddingHorizontal: GUTTER, paddingTop: insets.top + space.md, paddingBottom: insets.bottom + space.xl }}
        keyboardShouldPersistTaps="handled"
      >
        <Animated.View key={step} entering={dir ? enterFrom(dir) : undefined} style={{ flexGrow: 1 }}>
          {step === "welcome" ? (
            <Welcome
              onStart={() => go("register")}
              onSignIn={() => go("signin")}
              onDemo={() => {
                setEmail("demo@wayfare.app");
                setPassword("wanderlust");
                go("signin");
              }}
            />
          ) : (
            <View style={{ flexGrow: 1 }}>
              <Pressable
                onPress={() => go("welcome")}
                accessibilityRole="button"
                accessibilityLabel="Back"
                hitSlop={10}
                style={({ pressed }) => ({ height: 44, alignSelf: "flex-start", flexDirection: "row", alignItems: "center", marginLeft: -6, opacity: pressed ? 0.5 : 1 })}
              >
                <Ionicons name="chevron-back" size={22} color={colors.ink} />
                <T v="meta">Back</T>
              </Pressable>
              <T v="display" accessibilityRole="header" style={{ marginTop: space.lg, maxWidth: 360 }}>
                {register ? "Create your account" : "Welcome back."}
              </T>
              <T v="body" c="ink2" style={{ marginTop: space.sm, maxWidth: 340 }}>
                {register ? "Then tell Wayfare where you're going, and it lays out the days." : "Sign in to pick up where you left off."}
              </T>

              <View style={{ marginTop: space.xl, gap: space.lg, maxWidth: 440 }}>
                {notice && !error ? (
                  <T v="meta" c="caution" accessibilityLiveRegion="polite">
                    {notice}
                  </T>
                ) : null}
                {register ? (
                  <Animated.View entering={fadeIn} exiting={fadeOut}>
                    <Field label="Name" value={name} onChangeText={setName} placeholder="What should we call you?" autoComplete="name" returnKeyType="next" onSubmitEditing={() => emailRef.current?.focus()} />
                  </Animated.View>
                ) : null}
                {/* Everything below glides down to make room for Name, and back up. */}
                <Animated.View layout={reflow} style={{ gap: space.lg }}>
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
                    autoComplete={register ? "new-password" : "current-password"}
                    textContentType={register ? "newPassword" : "password"}
                    returnKeyType="go"
                    onSubmitEditing={submit}
                  />
                  {error ? (
                    <Animated.View entering={fadeIn}>
                      <T v="meta" c="danger" accessibilityLiveRegion="polite">
                        {error}
                      </T>
                    </Animated.View>
                  ) : null}
                  <Button size="lg" label={register ? "Create account" : "Sign in"} loading={busy} onPress={submit} />
                  <Pressable
                    onPress={() => go(register ? "signin" : "register")}
                    accessibilityRole="button"
                    hitSlop={13}
                    style={({ pressed }) => ({ alignSelf: "flex-start", opacity: pressed ? 0.5 : 1 })}
                  >
                    <T v="meta" c="ink2">
                      {register ? "Have an account? " : "New here? "}
                      <T v="meta" c="accent">
                        {register ? "Sign in" : "Create an account"}
                      </T>
                    </T>
                  </Pressable>
                </Animated.View>
              </View>
            </View>
          )}
        </Animated.View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function Welcome({ onStart, onSignIn, onDemo }: { onStart: () => void; onSignIn: () => void; onDemo: () => void }) {
  return (
    <View style={{ flexGrow: 1 }}>
      <Animated.View entering={enterUp(0)} style={{ height: 44, justifyContent: "center" }}>
        <T v="entry" style={{ letterSpacing: 0.2 }}>
          Wayfare
        </T>
      </Animated.View>
      <Animated.View entering={enterUp(1)}>
        <T v="display" accessibilityRole="header" style={{ marginTop: space.xxl, maxWidth: 360 }}>
          One plan for the whole trip.
        </T>
      </Animated.View>
      <Animated.View entering={enterUp(2)}>
        <T v="body" c="ink2" style={{ marginTop: space.md, maxWidth: 340 }}>
          Wayfare lays out each day, draws it on the map, and keeps count of what you spend, in any currency.
        </T>
      </Animated.View>
      <RouteSketch />
      <View style={{ flexGrow: 1, minHeight: space.xl }} />
      <Animated.View entering={enterUp(4)}>
        <Button size="lg" label="Get started" onPress={onStart} />
        <Button variant="quiet" label="I already have an account" onPress={onSignIn} style={{ alignSelf: "center", marginTop: space.lg }} />
        {SHOW_DEMO ? (
          <Pressable onPress={onDemo} accessibilityRole="button" hitSlop={13} style={({ pressed }) => ({ alignSelf: "center", marginTop: space.lg, opacity: pressed ? 0.5 : 1 })}>
            <T v="small" c="ink3">
              Just looking? Fill in the demo account
            </T>
          </Pressable>
        ) : null}
      </Animated.View>
    </View>
  );
}

// An example route, as the crow flies: three cities joined by lines that draw
// themselves in order, each city named as the line reaches it.
// Each city's name sits on the side of its dot that the lines leave free.
const SKETCH = { w: 342, h: 266 };
const ROUTE = [
  { city: "Tokyo", note: "3 days", x: 30, y: 64, label: { left: 18, top: 10 } },
  { city: "Kyoto", note: "4 days", x: 270, y: 128, label: { left: 252, top: 146 } },
  { city: "Osaka", note: "2 days", x: 70, y: 218, label: { left: 88, top: 222 } },
];
const LEG_MS = 650;
const legDelay = (i: number) => 250 + i * (LEG_MS - 100);

function RouteSketch() {
  const { colors } = useTheme();
  const [width, setWidth] = useState(SKETCH.w);
  const k = Math.min(1, width / SKETCH.w);
  const pts = ROUTE.map((p) => ({ ...p, x: p.x * k, y: p.y * k }));
  return (
    // Decorative: the sentence above says what it shows.
    <View
      onLayout={(e) => setWidth(e.nativeEvent.layout.width)}
      importantForAccessibility="no-hide-descendants"
      accessibilityElementsHidden
      style={{ marginTop: space.xl, height: SKETCH.h * k }}
    >
      {pts.slice(1).map((to, i) => (
        <Leg key={to.city} from={pts[i]} to={to} delay={legDelay(i)} />
      ))}
      {pts.map((p, i) => (
        <View key={p.city}>
          <View
            style={{ position: "absolute", left: p.x - 7, top: p.y - 7, width: 14, height: 14, borderRadius: 7, backgroundColor: colors.accent, borderWidth: 3, borderColor: colors.paper }}
          />
          <Animated.View
            entering={FadeIn.duration(motion.base)
              .delay(i === 0 ? 120 : legDelay(i - 1) + LEG_MS - 120)
              .reduceMotion(ReduceMotion.System)}
            style={{ position: "absolute", ...p.label, left: p.label.left * k, top: p.label.top * k }}
          >
            <T v="entry">{p.city}</T>
            <T v="small" c="ink3" num>
              {p.note}
            </T>
          </Animated.View>
        </View>
      ))}
    </View>
  );
}

function Leg({ from, to, delay }: { from: { x: number; y: number }; to: { x: number; y: number }; delay: number }) {
  const { colors } = useTheme();
  const length = Math.hypot(to.x - from.x, to.y - from.y);
  const angle = `${Math.atan2(to.y - from.y, to.x - from.x)}rad`;
  const drawn = useSharedValue(0);
  useEffect(() => {
    drawn.value = withDelay(delay, withTiming(1, { duration: LEG_MS, easing: settle, reduceMotion: ReduceMotion.System }));
  }, [delay, drawn]);
  const grow = useAnimatedStyle(() => ({ transform: [{ rotate: angle }, { scaleX: drawn.value }] }));
  const line = { position: "absolute" as const, left: from.x, top: from.y - 1, width: length, height: 2, borderRadius: 1, transformOrigin: "left center" };
  return (
    <>
      <View style={[line, { backgroundColor: colors.ruleStrong, transform: [{ rotate: angle }] }]} />
      <Animated.View style={[line, { backgroundColor: colors.accent }, grow]} />
    </>
  );
}

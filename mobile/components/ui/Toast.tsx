import React, { createContext, Fragment, useCallback, useContext, useRef, useState } from "react";
import { Platform, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { FullWindowOverlay } from "react-native-screens";
import Animated, { FadeInDown, FadeOutDown, ReduceMotion } from "react-native-reanimated";
import { Ionicons } from "@expo/vector-icons";
import { GUTTER, motion, radii, useTheme } from "@/shared/theme";
import { settle, startFrom } from "@/lib/motion";
import { T } from "./T";

type ToastVariant = "default" | "success" | "error";
type ToastState = { id: number; message: string; variant: ToastVariant } | null;

const ToastContext = createContext<(message: string, variant?: ToastVariant) => void>(() => {});

/** Confirms a completed action. A single ink slip near the bottom; 3s. */
export function useToast() {
  return useContext(ToastContext);
}

// iOS presents sheets (add expense, add stop…) above the app's own views, so
// a toast raised while one is open would sit behind it. This layer is above
// both, and lets touches through to whatever is underneath.
const Layer = Platform.OS === "ios" ? FullWindowOverlay : Fragment;

const enter = startFrom(FadeInDown.duration(260).easing(settle).reduceMotion(ReduceMotion.System), {
  opacity: 0,
  transform: [{ translateY: 16 }, { scale: 0.98 }],
});
const exit = FadeOutDown.duration(motion.fast).reduceMotion(ReduceMotion.System);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toast, setToast] = useState<ToastState>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const show = useCallback((message: string, variant: ToastVariant = "default") => {
    if (timer.current) clearTimeout(timer.current);
    setToast({ id: Date.now(), message, variant });
    timer.current = setTimeout(() => setToast(null), 3000);
  }, []);

  return (
    <ToastContext.Provider value={show}>
      {children}
      <Layer>{toast && <ToastView key={toast.id} message={toast.message} variant={toast.variant} />}</Layer>
    </ToastContext.Provider>
  );
}

function ToastView({ message, variant }: { message: string; variant: ToastVariant }) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const error = variant === "error";
  return (
    <View pointerEvents="none" style={{ position: "absolute", left: GUTTER, right: GUTTER, bottom: insets.bottom + 84, alignItems: "center" }}>
      <Animated.View
        entering={enter}
        exiting={exit}
        accessibilityLiveRegion="polite"
        accessibilityRole="alert"
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: 8,
          backgroundColor: error ? colors.danger : colors.ink,
          borderRadius: radii.md,
          borderCurve: "continuous",
          paddingHorizontal: 16,
          paddingVertical: 12,
          maxWidth: 420,
        }}
      >
        <Ionicons name={error ? "alert-circle-outline" : "checkmark"} size={16} color={colors.onInk} />
        <T v="meta" style={{ color: colors.onInk, flexShrink: 1 }}>
          {message}
        </T>
      </Animated.View>
    </View>
  );
}

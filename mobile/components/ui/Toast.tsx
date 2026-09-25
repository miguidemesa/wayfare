import React, { createContext, useCallback, useContext, useRef, useState } from "react";
import { View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated, { FadeInDown, FadeOutDown, ReduceMotion } from "react-native-reanimated";
import { GUTTER, radii, useTheme } from "@/shared/theme";
import { T } from "./T";

type ToastVariant = "default" | "success" | "error";
type ToastState = { id: number; message: string; variant: ToastVariant } | null;

const ToastContext = createContext<(message: string, variant?: ToastVariant) => void>(() => {});

/** Confirms a completed action. A single ink slip near the bottom; 3s. */
export function useToast() {
  return useContext(ToastContext);
}

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
      {toast && <ToastView key={toast.id} message={toast.message} variant={toast.variant} />}
    </ToastContext.Provider>
  );
}

function ToastView({ message, variant }: { message: string; variant: ToastVariant }) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <View pointerEvents="none" style={{ position: "absolute", left: GUTTER, right: GUTTER, bottom: insets.bottom + 84, alignItems: "center" }}>
      <Animated.View
        entering={FadeInDown.duration(220).reduceMotion(ReduceMotion.System)}
        exiting={FadeOutDown.duration(160).reduceMotion(ReduceMotion.System)}
        accessibilityLiveRegion="polite"
        accessibilityRole="alert"
        style={{
          backgroundColor: variant === "error" ? colors.danger : colors.ink,
          borderRadius: radii.md,
          paddingHorizontal: 16,
          paddingVertical: 12,
          maxWidth: 420,
        }}
      >
        <T v="meta" style={{ color: colors.onInk }}>
          {message}
        </T>
      </Animated.View>
    </View>
  );
}

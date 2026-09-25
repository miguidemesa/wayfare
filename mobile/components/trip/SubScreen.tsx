import { useEffect, useRef, type ReactNode } from "react";
import type { Href } from "expo-router";
import { KeyboardAvoidingView, Platform, RefreshControl, ScrollView, View } from "react-native";
import { GUTTER, space, useTheme } from "@/shared/theme";
import { useTrip } from "@/lib/trip";
import { TopBar } from "@/components/ui/Bars";
import { Failure, Loading } from "@/components/ui/Primitives";
import { T } from "@/components/ui/T";

/**
 * Frame for the trip's secondary pages (bookings, documents, packing…):
 * back to the trip, a serif title, pull to refresh. Waits for the bundle.
 */
export function SubScreen({
  title,
  intro,
  backLabel = "Trip",
  fallback,
  right,
  onRefresh,
  refreshing,
  children,
  footer,
  scrollTopWhen,
}: {
  title: string;
  intro?: string;
  backLabel?: string;
  /** Where Back goes when there's no history (deep link). */
  fallback?: Href;
  right?: ReactNode;
  onRefresh?: () => void;
  refreshing?: boolean;
  children: ReactNode;
  footer?: ReactNode;
  /** Scroll back to the top when this turns true, e.g. an inline form opening there. */
  scrollTopWhen?: boolean;
}) {
  const { colors } = useTheme();
  const { tripId, bundle, error, reload, refreshing: tripRefreshing } = useTrip();
  const scroller = useRef<ScrollView>(null);

  useEffect(() => {
    if (scrollTopWhen) scroller.current?.scrollTo({ y: 0, animated: true });
  }, [scrollTopWhen]);

  if (!bundle) {
    return error ? <Failure message={error} onRetry={() => void reload()} /> : <Loading />;
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: colors.paper }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <TopBar fallback={fallback ?? `/trips/${tripId}/details`} backLabel={backLabel} right={right} />
      <ScrollView
        ref={scroller}
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingBottom: space.xxxl }}
        keyboardShouldPersistTaps="handled"
        refreshControl={
          <RefreshControl refreshing={refreshing ?? tripRefreshing} onRefresh={onRefresh ?? (() => void reload())} tintColor={colors.ink3} />
        }
      >
        <View style={{ paddingHorizontal: GUTTER, paddingTop: space.md, paddingBottom: space.lg }}>
          <T v="title" accessibilityRole="header">{title}</T>
          {intro ? (
            <T v="meta" c="ink2" style={{ marginTop: 4 }}>
              {intro}
            </T>
          ) : null}
        </View>
        {children}
      </ScrollView>
      {footer}
    </KeyboardAvoidingView>
  );
}

import { SafeAreaView, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { TRAVEL_THEME } from "@/shared/theme";
import { Button } from "@/components/ui/Button";

interface ErrorFallbackProps {
  error: Error;
  retry: () => void;
}

// Rendered by expo-router in place of a route that threw during render.
// Every route can opt in by exporting its own `ErrorBoundary`; the root
// layout's copy is the last line of defense for anything left uncaught.
export function ErrorFallback({ error, retry }: ErrorFallbackProps) {
  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.iconWrap}>
        <Ionicons name="alert-circle-outline" size={40} color={TRAVEL_THEME.colors.danger} />
      </View>
      <Text style={styles.title}>Something went wrong</Text>
      <Text style={styles.message}>
        {__DEV__ ? error.message : "This screen ran into a problem. Try again, and if it keeps happening, restart the app."}
      </Text>
      <Button label="Try Again" variant="primary" onPress={retry} style={{ marginTop: 20 }} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 32,
    backgroundColor: TRAVEL_THEME.colors.bg,
  },
  iconWrap: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: TRAVEL_THEME.colors.dangerLight,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 18,
  },
  title: {
    fontFamily: "Georgia",
    fontSize: 20,
    color: TRAVEL_THEME.colors.inkPrimary,
    marginBottom: 8,
  },
  message: {
    fontSize: 14,
    lineHeight: 20,
    color: TRAVEL_THEME.colors.inkSecondary,
    textAlign: "center",
  },
});

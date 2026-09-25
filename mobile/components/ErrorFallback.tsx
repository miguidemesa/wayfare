import { View } from "react-native";
import { GUTTER, useTheme } from "@/shared/theme";
import { Empty } from "@/components/ui/Primitives";

interface ErrorFallbackProps {
  error: Error;
  retry: () => void;
}

// Rendered by expo-router in place of a route that threw during render.
export function ErrorFallback({ error, retry }: ErrorFallbackProps) {
  const { colors } = useTheme();
  return (
    <View style={{ flex: 1, justifyContent: "center", paddingHorizontal: GUTTER, backgroundColor: colors.paper }}>
      <Empty
        title="Something went wrong here"
        body={__DEV__ ? error.message : "Try again. If it keeps happening, restart Wayfare."}
        action="Try again"
        onAction={retry}
      />
    </View>
  );
}

import { Redirect } from "expo-router";
import { ActivityIndicator, View } from "react-native";
import { useAuth } from "@/lib/auth";
import { TRAVEL_THEME } from "@/shared/theme";

export default function Index() {
  const { ready, signedIn } = useAuth();
  if (!ready) {
    return (
      <View
        style={{
          flex: 1,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: TRAVEL_THEME.colors.bg,
        }}
      >
        <ActivityIndicator color={TRAVEL_THEME.colors.terracotta} />
      </View>
    );
  }
  return <Redirect href={signedIn ? "/trips" : "/login"} />;
}
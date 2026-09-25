import { Platform } from "react-native";

/** Modal flows slide up on both platforms and are dismissed downward. */
export const modalOptions = {
  presentation: "modal",
  animation: Platform.OS === "android" ? "slide_from_bottom" : "default",
  gestureEnabled: true,
} as const;

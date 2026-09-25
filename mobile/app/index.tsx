import { Redirect } from "expo-router";

// Signed-in entry point. Signed-out users never reach this route — the root
// Stack.Protected guard sends them to /login.
export default function Index() {
  return <Redirect href="/trips" />;
}

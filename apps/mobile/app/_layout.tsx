import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";

export default function RootLayout() {
  return (
    <>
      <StatusBar style="auto" />
      <Stack>
        <Stack.Screen name="index" options={{ title: "HalfThePrice" }} />
        <Stack.Screen name="browse" options={{ title: "Browse" }} />
        <Stack.Screen name="login" options={{ title: "Login" }} />
        <Stack.Screen name="seller" options={{ title: "Seller" }} />
        <Stack.Screen name="listings/[id]" options={{ title: "Listing" }} />
      </Stack>
    </>
  );
}

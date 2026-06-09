import { Link } from "expo-router";
import { StyleSheet, Text, View } from "react-native";
import { t } from "@/lib/i18n";

export default function HomeScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>HalfThePrice</Text>
      <Text style={styles.subtitle}>Verified ≤50% of retail · Iraq (IQD)</Text>
      <Link href="/browse" style={styles.link}>
        {t("browse")}
      </Link>
      <Link href="/login" style={styles.linkSecondary}>
        {t("login")}
      </Link>
      <Link href="/seller" style={styles.linkSecondary}>
        {t("seller")}
      </Link>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
    backgroundColor: "#fafafa",
  },
  title: {
    fontSize: 28,
    fontWeight: "700",
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    color: "#666",
    marginBottom: 32,
    textAlign: "center",
  },
  link: {
    backgroundColor: "#0d9488",
    color: "#fff",
    paddingVertical: 14,
    paddingHorizontal: 32,
    borderRadius: 999,
    overflow: "hidden",
    fontWeight: "600",
    marginBottom: 12,
  },
  linkSecondary: {
    color: "#0d9488",
    paddingVertical: 10,
    fontWeight: "500",
  },
});

import { useEffect, useState } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { useLocalSearchParams } from "expo-router";
import { formatIqd } from "@htp/contracts";
import { api } from "@/lib/api";
import type { ListingSummary } from "@htp/sdk";
import { t } from "@/lib/i18n";

export default function ListingDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [listing, setListing] = useState<ListingSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!id) return;
    api
      .getListing(id)
      .then(setListing)
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#0d9488" />
      </View>
    );
  }

  if (error || !listing) {
    return (
      <View style={styles.centered}>
        <Text style={styles.error}>{error || "Not found"}</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>{listing.title}</Text>
      <Text style={styles.price}>
        {t("price")}: {formatIqd(listing.sellerPriceIqd)}
      </Text>
      <Text style={styles.meta}>
        {t("governorate")}: {listing.governorate}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  centered: { flex: 1, alignItems: "center", justifyContent: "center" },
  container: { flex: 1, padding: 24 },
  title: { fontSize: 24, fontWeight: "700", marginBottom: 12 },
  price: { fontSize: 20, fontWeight: "600", color: "#0d9488" },
  meta: { fontSize: 14, color: "#666", marginTop: 8 },
  error: { color: "#dc2626" },
});

import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { formatIqd } from "@htp/contracts";
import { api } from "@/lib/api";
import type { ListingSummary } from "@htp/sdk";
import { t } from "@/lib/i18n";

export default function SellerScreen() {
  const [listings, setListings] = useState<ListingSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    api
      .getSellerListings()
      .then((res) => setListings(res.data))
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#0d9488" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.heading}>{t("listings")}</Text>
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <FlatList
        data={listings}
        keyExtractor={(item) => item.id}
        ListEmptyComponent={<Text style={styles.empty}>{t("noListings")}</Text>}
        renderItem={({ item }) => (
          <View style={styles.card}>
            <Text style={styles.title}>{item.title}</Text>
            <Text style={styles.price}>{formatIqd(item.sellerPriceIqd)}</Text>
          </View>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16 },
  centered: { flex: 1, alignItems: "center", justifyContent: "center" },
  heading: { fontSize: 20, fontWeight: "700", marginBottom: 12 },
  card: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: "#e5e5e5",
  },
  title: { fontSize: 15, fontWeight: "600" },
  price: { color: "#0d9488", marginTop: 4, fontWeight: "600" },
  empty: { color: "#666", textAlign: "center", marginTop: 24 },
  error: { color: "#dc2626", marginBottom: 8 },
});

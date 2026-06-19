import { getLiveListings } from "./listings";

async function main() {
  console.log("Running getLiveListings for Samsun...");
  const start = Date.now();
  const res = await getLiveListings({ query: "Samsun" });
  console.log("Finished in", Date.now() - start, "ms");
  console.log("Results count:", res.data.length);
}

main().catch(console.error);

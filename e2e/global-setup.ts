import { execSync } from "child_process";

async function globalSetup() {
  console.log("Global setup: seeding database...");
  try {
    execSync("pnpm db:seed", { stdio: "inherit" });
  } catch (error) {
    console.error("Failed to seed database in global setup:", error);
    process.exit(1);
  }
}

export default globalSetup;

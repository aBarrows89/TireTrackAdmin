// Migration script to copy trucks and scans from dev to production
// Run with: npx ts-node scripts/migrate-to-production.ts

import { ConvexHttpClient } from "convex/browser";

const DEV_URL = "https://wary-squirrel-295.convex.cloud";
const PROD_URL = "https://energetic-badger-312.convex.cloud";

async function migrate() {
  const devClient = new ConvexHttpClient(DEV_URL);
  const prodClient = new ConvexHttpClient(PROD_URL);

  console.log("Fetching data from dev database...");

  // Fetch all trucks from dev
  const devTrucks = await devClient.query("queries:getAllTrucks" as any);
  console.log(`Found ${devTrucks.length} trucks in dev`);

  // Fetch all scans from dev
  const devScans = await devClient.query("queries:getAllScans" as any);
  console.log(`Found ${devScans?.length || 0} scans in dev`);

  // Fetch all users from dev
  const devUsers = await devClient.query("queries:getAllUsers" as any);
  console.log(`Found ${devUsers.length} users in dev`);

  console.log("\nData to migrate:");
  console.log("- Trucks:", devTrucks.length);
  console.log("- Users:", devUsers.length);

  // Log truck details
  devTrucks.forEach((t: any) => {
    console.log(`  - ${t.truckNumber} (${t.status}) - ${t.scanCount} scans`);
  });
}

migrate().catch(console.error);

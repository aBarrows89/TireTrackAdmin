// Reset password and test login
const { ConvexHttpClient } = require("convex/browser");

const DEV_URL = "https://wary-squirrel-295.convex.cloud";

async function fixAdmin() {
  const devClient = new ConvexHttpClient(DEV_URL);

  console.log("=== Fixing Admin Account ===\n");

  // 1. Get admin
  const devAdmins = await devClient.query("auth:getAllAdmins" as any);
  const admin = devAdmins?.find((a: any) => a.email === "andy@ietires.com");

  if (!admin) {
    console.log("Admin not found!");
    return;
  }

  console.log("Admin:", admin.email);
  console.log("Role:", admin.role);
  console.log("ID:", admin.id);

  // 2. Reset password
  console.log("\nResetting password to 'admin123'...");
  await devClient.mutation("auth:resetAdminPassword" as any, {
    adminId: admin.id,
    newPassword: "admin123",
  });
  console.log("✓ Password reset");

  // 3. Test login
  console.log("\n--- Testing login ---");
  const result = await devClient.mutation("auth:login" as any, {
    email: "andy@ietires.com",
    password: "admin123",
  });
  console.log("Login result:", JSON.stringify(result, null, 2));
}

fixAdmin().catch(console.error);

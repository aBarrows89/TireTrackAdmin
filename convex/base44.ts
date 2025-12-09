import { action } from "./_generated/server";
import { v } from "convex/values";
import { api } from "./_generated/api";

const BASE44_API_URL = "https://app.base44.com/api/apps/6926084c75b23cb7613a3ee5";
const BASE44_API_KEY = "1331a4731f5a4aca8d6eeea6f7e6090b";

async function base44Fetch(endpoint: string, options: RequestInit = {}): Promise<any> {
  const response = await fetch(`${BASE44_API_URL}${endpoint}`, {
    ...options,
    headers: {
      "api_key": BASE44_API_KEY,
      "Content-Type": "application/json",
      ...options.headers,
    },
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Base44 API error: ${response.status} - ${error}`);
  }

  return response.json();
}

function chunkArray<T>(array: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < array.length; i += size) {
    chunks.push(array.slice(i, i + size));
  }
  return chunks;
}

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export const createTruckManifest = action({
  args: {
    truckId: v.id("trucks"),
  },
  handler: async (ctx, args): Promise<{ success: boolean; manifestId: string; syncedScans: number; totalScans: number }> => {
    const truck = await ctx.runQuery(api.httpQueries.getTruckWithScans, {
      truckId: args.truckId,
    });

    if (!truck) {
      throw new Error("Truck not found");
    }

    let manifestId: string = truck.base44Id || "";
    
    // Only create manifest if we don't have one yet
    if (!manifestId) {
      const manifestData = {
        truck_number: truck.truckNumber,
        carrier: truck.carrier,
        status: truck.status,
        location_id: truck.locationId,
        opened_at: new Date(truck.openedAt).toISOString(),
        closed_at: truck.closedAt ? new Date(truck.closedAt).toISOString() : null,
        security_tag: truck.securityTag,
        opened_by: truck.openedByEmpId,
        closed_by: truck.closedByEmpId,
        scan_count: truck.scans.length,
      };

      const manifest = await base44Fetch("/entities/TruckManifest", {
        method: "POST",
        body: JSON.stringify(manifestData),
      });
      
      manifestId = manifest.id || manifest._id || "";
      
      // SAVE MANIFEST ID IMMEDIATELY so retries use same manifest
      await ctx.runMutation(api.mutations.markTruckSynced, {
        truckId: args.truckId,
        base44Id: manifestId,
      });
    }

    // Get existing scan tracking numbers from Base44 to avoid duplicates
    let existingTrackingNumbers: Set<string> = new Set();
    try {
      const existingScans = await base44Fetch(`/entities/ShipmentItem?truck_session_id=${manifestId}`);
      if (Array.isArray(existingScans)) {
        existingScans.forEach((s: any) => existingTrackingNumbers.add(s.tracking_number));
      }
    } catch (e) {
      // If we can't fetch existing, continue anyway
      console.log("Could not fetch existing scans, continuing...");
    }

    // Filter to only unsynced scans
    const unsynced = truck.scans.filter(s => !existingTrackingNumbers.has(s.trackingNumber));
    
    if (unsynced.length === 0) {
      return { 
        success: true, 
        manifestId, 
        syncedScans: truck.scans.length, 
        totalScans: truck.scans.length 
      };
    }

    const scanChunks = chunkArray(unsynced, 5); // Smaller chunks
    let syncedScans = existingTrackingNumbers.size;

    for (let i = 0; i < scanChunks.length; i++) {
      const chunk = scanChunks[i];
      
      for (const scan of chunk) {
        try {
          await base44Fetch("/entities/ShipmentItem", {
            method: "POST",
            body: JSON.stringify({
              truck_session_id: manifestId,
              tracking_number: scan.trackingNumber,
              destination: scan.destination,
              scanned_at: new Date(scan.scannedAt).toISOString(),
            }),
          });
          syncedScans++;
        } catch (error: any) {
          if (error.message.includes("429")) {
            // Rate limited - stop and let cron retry later
            console.log(`Rate limited at ${syncedScans}/${truck.scans.length} scans`);
            return {
              success: false,
              manifestId,
              syncedScans,
              totalScans: truck.scans.length
            };
          }
          console.error(`Failed to sync scan ${scan.trackingNumber}:`, error.message);
        }
        // Delay between each scan
        await delay(1000);
      }
      
      // Longer delay between batches
      if (i < scanChunks.length - 1) {
        await delay(5000);
      }
    }

    return { 
      success: syncedScans === truck.scans.length, 
      manifestId, 
      syncedScans, 
      totalScans: truck.scans.length 
    };
  },
});

export const retrySyncClosedTrucks = action({
  args: {},
  handler: async (ctx): Promise<{ success: boolean; synced: number; failed: number }> => {
    const unsyncedTrucks = await ctx.runQuery(api.httpQueries.getUnsyncedTrucks);
    
    let synced = 0;
    let failed = 0;

    for (const truck of unsyncedTrucks) {
      if (truck.status === "closed") {
        try {
          const result = await ctx.runAction(api.base44.createTruckManifest, {
            truckId: truck._id,
          });
          if (result.success) {
            synced++;
          } else {
            // Partial sync - will retry next time
            console.log(`Partial sync for ${truck.truckNumber}: ${result.syncedScans}/${result.totalScans}`);
          }
        } catch (error) {
          console.error(`Failed to sync truck ${truck.truckNumber}:`, error);
          failed++;
        }
        // Long delay between trucks
        await delay(5000);
      }
    }

    return { success: true, synced, failed };
  },
});

export const syncUsersFromBase44 = action({
  args: {},
  handler: async (ctx): Promise<{ success: boolean; synced: number }> => {
    const users: any[] = await base44Fetch("/entities/AppUser");
    let synced = 0;

    for (const user of users) {
      try {
        await ctx.runMutation(api.mutations.upsertUser, {
          base44Id: user.id || user._id || "",
          empId: user.employee_id || "",
          name: user.name || "",
          pin: user.pin || "0000",
          locationId: user.location || user.location_id || "",
          locationName: user.location || user.location_name || "",
          role: user.role || "loader",
          isActive: user.is_active !== false,
        });
        synced++;
      } catch (error) {
        console.error("Failed to sync user:", error);
      }
    }

    return { success: true, synced };
  },
});

export const syncLocationsFromBase44 = action({
  args: {},
  handler: async (ctx): Promise<{ success: boolean; synced: number }> => {
    const locations: any[] = await base44Fetch("/entities/Location");
    let synced = 0;

    for (const location of locations) {
      try {
        await ctx.runMutation(api.mutations.upsertLocation, {
          base44Id: location.id || location._id || "",
          name: location.name || "",
          code: location.code || location.location_code || location.id || "",
        });
        synced++;
      } catch (error) {
        console.error("Failed to sync location:", error);
      }
    }

    return { success: true, synced };
  },
});

export const backfillVendorsToBase44 = action({
  args: {},
  handler: async (ctx): Promise<{ updated: number; failed: number; skipped: number }> => {
    const manifests = await base44Fetch("/entities/TruckManifest");
    
    let updated = 0;
    let failed = 0;
    let skipped = 0;

    for (const manifest of manifests) {
      try {
        const items = await base44Fetch(`/entities/ShipmentItem?truck_session_id=${manifest.id}`);
        
        for (const item of items) {
          if (item.vendor && item.vendor !== "Unknown") {
            skipped++;
            continue;
          }
          
          const scan = await ctx.runQuery(api.queries.getScanByTracking, { 
            trackingNumber: item.tracking_number 
          });
          
          if (scan?.vendor && scan.vendor !== "Unknown") {
            await base44Fetch(`/entities/ShipmentItem/${item.id}`, {
              method: "PUT",
              body: JSON.stringify({ ...item, vendor: scan.vendor }),
            });
            updated++;
          }
          
          await new Promise(r => setTimeout(r, 200));
        }
      } catch (error) {
        console.error(`Failed manifest ${manifest.id}:`, error);
        failed++;
      }
    }

    return { updated, failed, skipped };
  },
});
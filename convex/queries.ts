import { query } from "./_generated/server";
import { v } from "convex/values";

// Get user by Employee ID (for login)
export const getUserByEmpId = query({
  args: { empId: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("users")
      .withIndex("by_empId", (q) => q.eq("empId", args.empId.toUpperCase()))
      .first();
  },
});

// Validate user PIN
export const validateUserPin = query({
  args: { empId: v.string(), pin: v.string() },
  handler: async (ctx, args) => {
    const user = await ctx.db
      .query("users")
      .withIndex("by_empId", (q) => q.eq("empId", args.empId.toUpperCase()))
      .first();

    if (!user) {
      return { valid: false, error: "User not found", user: null };
    }

    if (!user.isActive) {
      return { valid: false, error: "Account disabled", user: null };
    }

    if (user.pin !== args.pin) {
      return { valid: false, error: "Invalid PIN", user: null };
    }

    return { valid: true, error: null, user };
  },
});

// Get open trucks for a location
export const getOpenTrucks = query({
  args: { locationId: v.string() },
  handler: async (ctx, args) => {
    const trucks = await ctx.db
      .query("trucks")
      .withIndex("by_location_status", (q) =>
        q.eq("locationId", args.locationId).eq("status", "open")
      )
      .collect();

    // Enrich with scan counts
    const enrichedTrucks = await Promise.all(
      trucks.map(async (truck) => {
        const scans = await ctx.db
          .query("scans")
          .withIndex("by_truck", (q) => q.eq("truckId", truck._id))
          .collect();
        return {
          ...truck,
          scanCount: scans.length,
        };
      })
    );

    return enrichedTrucks;
  },
});

// Get all scans for a truck
export const getTruckScans = query({
  args: { truckId: v.id("trucks") },
  handler: async (ctx, args) => {
    const scans = await ctx.db
      .query("scans")
      .withIndex("by_truck", (q) => q.eq("truckId", args.truckId))
      .collect();

    // Enrich with user names
    const enrichedScans = await Promise.all(
      scans.map(async (scan) => {
        const user = await ctx.db.get(scan.scannedBy);
        return {
          ...scan,
          scannedByName: user?.name ?? "Unknown",
        };
      })
    );

    return enrichedScans;
  },
});

// Get truck by ID with scan count
export const getTruck = query({
  args: { truckId: v.id("trucks") },
  handler: async (ctx, args) => {
    const truck = await ctx.db.get(args.truckId);
    if (!truck) return null;

    const scans = await ctx.db
      .query("scans")
      .withIndex("by_truck", (q) => q.eq("truckId", args.truckId))
      .collect();

    const openedByUser = await ctx.db.get(truck.openedBy);

    return {
      ...truck,
      scanCount: scans.length,
      openedByName: openedByUser?.name ?? "Unknown",
    };
  },
});

// Get all locations
export const getLocations = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db
      .query("locations")
      .filter((q) => q.eq(q.field("isActive"), true))
      .collect();
  },
});

// Get recent scans for a truck (with limit)
export const getRecentTruckScans = query({
  args: { truckId: v.id("trucks"), limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const scans = await ctx.db
      .query("scans")
      .withIndex("by_truck", (q) => q.eq("truckId", args.truckId))
      .order("desc")
      .take(args.limit ?? 10);

    const enrichedScans = await Promise.all(
      scans.map(async (scan) => {
        const user = await ctx.db.get(scan.scannedBy);
        return {
          ...scan,
          scannedByName: user?.name ?? "Unknown",
        };
      })
    );

    return enrichedScans;
  },
});

// Get open return batches for a location
export const getOpenReturnBatches = query({
  args: { locationId: v.string() },
  handler: async (ctx, args) => {
    const batches = await ctx.db
      .query("returnBatches")
      .withIndex("by_location_status", (q) =>
        q.eq("locationId", args.locationId).eq("status", "open")
      )
      .collect();

    const enrichedBatches = await Promise.all(
      batches.map(async (batch) => {
        const items = await ctx.db
          .query("returnItems")
          .withIndex("by_batch", (q) => q.eq("returnBatchId", batch._id))
          .collect();
        const openedByUser = await ctx.db.get(batch.openedBy);
        return {
          ...batch,
          itemCount: items.length,
          openedByName: openedByUser?.name ?? "Unknown",
        };
      })
    );

    return enrichedBatches;
  },
});

// Get return batch by ID with item count
export const getReturnBatch = query({
  args: { batchId: v.id("returnBatches") },
  handler: async (ctx, args) => {
    const batch = await ctx.db.get(args.batchId);
    if (!batch) return null;

    const items = await ctx.db
      .query("returnItems")
      .withIndex("by_batch", (q) => q.eq("returnBatchId", args.batchId))
      .collect();

    const openedByUser = await ctx.db.get(batch.openedBy);

    return {
      ...batch,
      itemCount: items.length,
      openedByName: openedByUser?.name ?? "Unknown",
    };
  },
});

// Get return items for a batch
export const getReturnItems = query({
  args: { batchId: v.id("returnBatches") },
  handler: async (ctx, args) => {
    const items = await ctx.db
      .query("returnItems")
      .withIndex("by_batch", (q) => q.eq("returnBatchId", args.batchId))
      .order("desc")
      .collect();

    const enrichedItems = await Promise.all(
      items.map(async (item) => {
        const user = await ctx.db.get(item.scannedBy);
        return {
          ...item,
          scannedByName: user?.name ?? "Unknown",
        };
      })
    );

    return enrichedItems;
  },
});

export const getTireByUPC = query({
  args: { upc: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("tireUPCs")
      .withIndex("by_upc", (q) => q.eq("upc", args.upc))
      .first();
  },
});

export const countUnknownVendors = query({
  args: {},
  handler: async (ctx) => {
    const scans = await ctx.db.query("scans").collect();
    const unknown = scans.filter(s => !s.vendor || s.vendor === "Unknown");
    const known = scans.filter(s => s.vendor && s.vendor !== "Unknown");
    
    // Group unknowns by rawBarcode pattern
    const patterns: Record<string, number> = {};
    for (const scan of unknown) {
      const raw = scan.rawBarcode || "";
      const isUPS = raw.includes("UPSN") || raw.startsWith("1Z");
      const isFedEx = raw.includes("FDEG") || raw.includes("[)>");
      const key = isUPS ? "UPS" : isFedEx ? "FedEx (unmapped)" : "Other";
      patterns[key] = (patterns[key] || 0) + 1;
    }
    
    return {
      total: scans.length,
      known: known.length,
      unknown: unknown.length,
      patterns
    };
  },
});

export const getScanByTracking = query({
  args: { trackingNumber: v.string() },
  handler: async (ctx, args) => {
    const scans = await ctx.db.query("scans").collect();
    return scans.find(s => s.trackingNumber === args.trackingNumber) || null;
  },
});

export const getUnmappedFedExScans = query({
  args: {},
  handler: async (ctx) => {
    const scans = await ctx.db.query("scans").collect();
    const unmapped = scans.filter(s => {
      const raw = s.rawBarcode || "";
      const isFedEx = raw.includes("FDEG") || raw.includes("[)>");
      const noVendor = !s.vendor || s.vendor === "Unknown";
      return isFedEx && noVendor;
    });
    
    return unmapped.map(s => ({
      _id: s._id,
      trackingNumber: s.trackingNumber,
      truckId: s.truckId,
      rawBarcode: s.rawBarcode,
    }));
  },
});
export const findUnknownAccounts = query({
  args: {},
  handler: async (ctx) => {
    const scans = await ctx.db.query("scans").collect();
    const unknown = scans.filter(s => !s.vendor || s.vendor === "Unknown");
    const accounts: Record<string, { count: number, sample: string }> = {};
    for (const scan of unknown) {
      const raw = scan.rawBarcode || "";
      const fdegMatch = raw.match(/FDEG\x1d(\d{7,9})/);
      if (fdegMatch) {
        const acct = fdegMatch[1];
        if (!accounts[acct]) {
          accounts[acct] = { count: 0, sample: scan.trackingNumber };
        }
        accounts[acct].count++;
      }
    }
    return Object.entries(accounts)
      .sort((a, b) => b[1].count - a[1].count)
      .map(([account, data]) => ({ account, count: data.count, sampleTracking: data.sample }));
  },
});

export const getAllTrucks = query({
  args: {},
  handler: async (ctx) => {
    const trucks = await ctx.db.query("trucks").order("desc").collect();
    
    const enrichedTrucks = await Promise.all(
      trucks.map(async (truck) => {
        const scans = await ctx.db
          .query("scans")
          .withIndex("by_truck", (q) => q.eq("truckId", truck._id))
          .collect();
        return {
          ...truck,
          scanCount: scans.length,
        };
      })
    );

    return enrichedTrucks;
  },
});

export const getAllUsers = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query("users").collect();
  },
});

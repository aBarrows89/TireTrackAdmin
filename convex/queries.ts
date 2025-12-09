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

export const searchUPCs = query({
  args: { 
    search: v.optional(v.string()),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const limit = args.limit || 50;
    
    if (!args.search || args.search.length < 2) {
      return await ctx.db.query("tireUPCs").take(limit);
    }
    
    const search = args.search.toLowerCase();
    const all = await ctx.db.query("tireUPCs").collect();
    
    return all
      .filter((t) => 
        t.upc.toLowerCase().includes(search) ||
        t.brand.toLowerCase().includes(search) ||
        t.size.toLowerCase().includes(search) ||
        (t.inventoryNumber && t.inventoryNumber.toLowerCase().includes(search))
      )
      .slice(0, limit);
  },
});

export const getUPCCount = query({
  args: {},
  handler: async (ctx) => {
    const all = await ctx.db.query("tireUPCs").collect();
    return all.length;
  },
});

export const getUPCByCode = query({
  args: { upc: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("tireUPCs")
      .withIndex("by_upc", (q) => q.eq("upc", args.upc))
      .first();
  },
});

export const getAllReturnBatches = query({
  args: {},
  handler: async (ctx) => {
    const batches = await ctx.db.query("returnBatches").order("desc").collect();
    
    const enrichedBatches = await Promise.all(
      batches.map(async (batch) => {
        const opener = await ctx.db.get(batch.openedBy);
        const closer = batch.closedBy ? await ctx.db.get(batch.closedBy) : null;
        return {
          ...batch,
          openedByName: opener?.name || "Unknown",
          closedByName: closer?.name || undefined,
        };
      })
    );
    
    return enrichedBatches;
  },
});

export const getReturnBatchItems = query({
  args: { batchId: v.id("returnBatches") },
  handler: async (ctx, args) => {
    const items = await ctx.db
      .query("returnItems")
      .withIndex("by_batch", (q) => q.eq("returnBatchId", args.batchId))
      .collect();

    const enrichedItems = await Promise.all(
      items.map(async (item) => {
        const scanner = await ctx.db.get(item.scannedBy);

        // Resolve image URL if it's a storage ID
        let resolvedImageUrl = item.imageUrl;
        if (item.imageUrl && !item.imageUrl.startsWith("http")) {
          // It might be a Convex storage ID - try to resolve it
          try {
            const url = await ctx.storage.getUrl(item.imageUrl as any);
            if (url) {
              resolvedImageUrl = url;
            }
          } catch {
            // If it fails, keep the original value
          }
        }

        return {
          ...item,
          imageUrl: resolvedImageUrl,
          scannedByName: scanner?.name || "Unknown",
        };
      })
    );

    return enrichedItems;
  },
});

export const getReturnStats = query({
  args: {},
  handler: async (ctx) => {
    const batches = await ctx.db.query("returnBatches").collect();
    const items = await ctx.db.query("returnItems").collect();

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayTimestamp = today.getTime();

    const openBatches = batches.filter(b => b.status === "open").length;
    const batchesToday = batches.filter(b => b.openedAt >= todayTimestamp).length;
    const itemsToday = items.filter(i => i.scannedAt >= todayTimestamp).length;

    const processed = items.filter(i => i.status === "processed").length;
    const notProcessed = items.filter(i => i.status === "not_processed").length;
    const pending = items.filter(i => i.status === "pending").length;

    return {
      totalBatches: batches.length,
      openBatches,
      batchesToday,
      totalItems: items.length,
      itemsToday,
      processed,
      notProcessed,
      pending,
    };
  },
});

export const getAllScans = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query("scans").collect();
  },
});

export const getScansToday = query({
  args: { midnightTimestamp: v.number() },
  handler: async (ctx, args) => {
    const scans = await ctx.db.query("scans").collect();
    return scans.filter(s => s.scannedAt >= args.midnightTimestamp).length;
  },
});

// Get trucks for report (with date filter)
export const getTrucksForReport = query({
  args: {
    startDate: v.number(),
    endDate: v.number(),
  },
  handler: async (ctx, args) => {
    const trucks = await ctx.db.query("trucks").collect();
    const filtered = trucks.filter(t =>
      t.openedAt >= args.startDate && t.openedAt <= args.endDate
    );

    const enriched = await Promise.all(
      filtered.map(async (truck) => {
        const scans = await ctx.db
          .query("scans")
          .withIndex("by_truck", (q) => q.eq("truckId", truck._id))
          .collect();

        // Group by vendor
        const byVendor: Record<string, typeof scans> = {};
        for (const scan of scans) {
          const vendor = scan.vendor || "Unknown";
          if (!byVendor[vendor]) byVendor[vendor] = [];
          byVendor[vendor].push(scan);
        }

        return {
          ...truck,
          scans,
          scanCount: scans.length,
          byVendor,
          vendors: Object.keys(byVendor),
        };
      })
    );

    return enriched;
  },
});

// Get detailed manifest for a truck by vendor
export const getTruckManifestByVendor = query({
  args: { truckId: v.id("trucks") },
  handler: async (ctx, args) => {
    const truck = await ctx.db.get(args.truckId);
    if (!truck) return null;

    const scans = await ctx.db
      .query("scans")
      .withIndex("by_truck", (q) => q.eq("truckId", args.truckId))
      .collect();

    // Group by vendor
    const byVendor: Record<string, any[]> = {};
    for (const scan of scans) {
      const vendor = scan.vendor || "Unknown";
      if (!byVendor[vendor]) byVendor[vendor] = [];
      byVendor[vendor].push({
        trackingNumber: scan.trackingNumber,
        carrier: scan.carrier,
        destination: scan.destination,
        recipientName: scan.recipientName,
        address: scan.address,
        city: scan.city,
        state: scan.state,
        scannedAt: scan.scannedAt,
        vendorAccount: scan.vendorAccount,
      });
    }

    return {
      truck: {
        truckNumber: truck.truckNumber,
        carrier: truck.carrier,
        status: truck.status,
        openedAt: truck.openedAt,
        closedAt: truck.closedAt,
      },
      totalScans: scans.length,
      byVendor,
    };
  },
});

// Search for a tracking number across all trucks
export const searchTrackingNumber = query({
  args: {
    trackingNumber: v.string(),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    if (args.trackingNumber.length < 3) return [];

    const limit = args.limit || 50;
    const searchTerm = args.trackingNumber.toLowerCase();

    const allScans = await ctx.db.query("scans").collect();

    const matchingScans = allScans
      .filter(scan => scan.trackingNumber.toLowerCase().includes(searchTerm))
      .slice(0, limit);

    // Enrich with truck info
    const enriched = await Promise.all(
      matchingScans.map(async (scan) => {
        const truck = await ctx.db.get(scan.truckId);
        const user = await ctx.db.get(scan.scannedBy);
        return {
          ...scan,
          truckNumber: truck?.truckNumber || "Unknown",
          truckStatus: truck?.status || "unknown",
          truckCarrier: truck?.carrier || "Unknown",
          scannedByName: user?.name || "Unknown",
        };
      })
    );

    return enriched;
  },
});

// Get vendor report for a date range (all scans for a vendor across all trucks in date range)
export const getVendorDateRangeReport = query({
  args: {
    startDate: v.number(),
    endDate: v.number(),
    vendor: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    // Get all trucks in date range
    const trucks = await ctx.db.query("trucks").collect();
    const filteredTrucks = trucks.filter(t =>
      t.openedAt >= args.startDate && t.openedAt <= args.endDate
    );

    // Get all scans for these trucks
    const allScans: any[] = [];
    for (const truck of filteredTrucks) {
      const scans = await ctx.db
        .query("scans")
        .withIndex("by_truck", (q) => q.eq("truckId", truck._id))
        .collect();

      for (const scan of scans) {
        // Filter by vendor if specified
        if (args.vendor && scan.vendor !== args.vendor) continue;

        allScans.push({
          ...scan,
          truckNumber: truck.truckNumber,
          truckCarrier: truck.carrier,
          truckOpenedAt: truck.openedAt,
          truckClosedAt: truck.closedAt,
        });
      }
    }

    // Group by vendor
    const byVendor: Record<string, typeof allScans> = {};
    for (const scan of allScans) {
      const vendor = scan.vendor || "Unknown";
      if (!byVendor[vendor]) byVendor[vendor] = [];
      byVendor[vendor].push(scan);
    }

    // Sort vendors and get stats
    const vendors = Object.keys(byVendor).sort();
    const stats = vendors.map(vendor => ({
      vendor,
      count: byVendor[vendor].length,
      trucks: [...new Set(byVendor[vendor].map(s => s.truckNumber))].length,
    }));

    return {
      startDate: args.startDate,
      endDate: args.endDate,
      totalScans: allScans.length,
      totalTrucks: filteredTrucks.length,
      vendors: stats,
      byVendor,
    };
  },
});

// Get all vendors that have scans
export const getAllVendors = query({
  args: {},
  handler: async (ctx) => {
    const scans = await ctx.db.query("scans").collect();
    const vendors = new Set(scans.map(s => s.vendor || "Unknown"));
    return Array.from(vendors).sort();
  },
});

// Debug query to check return item image URLs
export const debugReturnItemImages = query({
  args: {},
  handler: async (ctx) => {
    const items = await ctx.db.query("returnItems").take(20);

    const results = await Promise.all(
      items.map(async (item) => {
        let resolvedUrl = null;
        let storageError = null;

        if (item.imageUrl) {
          // Try to resolve as storage ID
          if (!item.imageUrl.startsWith("http")) {
            try {
              resolvedUrl = await ctx.storage.getUrl(item.imageUrl as any);
            } catch (e: any) {
              storageError = e?.message || "Failed to resolve";
            }
          } else {
            resolvedUrl = item.imageUrl;
          }
        }

        return {
          id: item._id,
          rawImageUrl: item.imageUrl || null,
          startsWithHttp: item.imageUrl?.startsWith("http") || false,
          resolvedUrl,
          storageError,
          hasImage: !!item.imageUrl,
        };
      })
    );

    return {
      totalItems: items.length,
      itemsWithImageUrl: results.filter(r => r.hasImage).length,
      itemsWithResolvedUrl: results.filter(r => r.resolvedUrl).length,
      items: results,
    };
  },
});

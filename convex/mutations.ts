import { mutation } from "./_generated/server";
import { v } from "convex/values";

const VENDOR_ACCOUNTS = [
  { account: "12182316", vendor: "Simple Tire" },
  { account: "10476E", vendor: "Simple Tire" },
  { account: "956335570", vendor: "Priority Tires" },
  { account: "699590177", vendor: "Tire Easy" },
  { account: "4475664", vendor: "Fastlane" },
  { account: "693242410", vendor: "United Tires" },
  { account: "9556328", vendor: "Autoplicity" },
  { account: "200733892", vendor: "Tire Depot Co" },
  { account: "9791484", vendor: "Tire Agent" },
  { account: "8016150", vendor: "Atturo Tires" },
  { account: "9943973", vendor: "Huantian" },
  { account: "208536660", vendor: "WTD" },
  { account: "9785933", vendor: "WTD" },
  { account: "878898850", vendor: "WTD" },
  { account: "200729671", vendor: "WTD" },
  { account: "7655055", vendor: "WTD" },
];

export const createUser = mutation({
  args: {
    base44Id: v.string(),
    empId: v.string(),
    name: v.string(),
    pin: v.string(),
    locationId: v.string(),
    locationName: v.string(),
    role: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("users")
      .withIndex("by_empId", (q) => q.eq("empId", args.empId))
      .first();
    if (existing) {
      return { success: false, error: "Employee ID already exists" };
    }
    const userId = await ctx.db.insert("users", {
      ...args,
      isActive: true,
    });
    return { success: true, userId };
  },
});

export const openTruck = mutation({
  args: {
    truckNumber: v.string(),
    carrier: v.string(),
    locationId: v.string(),
    userId: v.id("users"),
  },
  handler: async (ctx, args) => {
    const truckId = await ctx.db.insert("trucks", {
      truckNumber: args.truckNumber,
      carrier: args.carrier,
      status: "open",
      locationId: args.locationId,
      openedBy: args.userId,
      openedAt: Date.now(),
    });
    return { success: true, truckId };
  },
});

export const addScan = mutation({
  args: {
    truckId: v.id("trucks"),
    trackingNumber: v.string(),
    carrier: v.optional(v.string()),
    destination: v.string(),
    recipientName: v.optional(v.string()),
    address: v.optional(v.string()),
    city: v.optional(v.string()),
    state: v.optional(v.string()),
    rawBarcode: v.string(),
    userId: v.id("users"),
    scanType: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    let vendor = "Unknown";
    let vendorAccount = "";
    const raw = args.rawBarcode || "";
    
    for (const va of VENDOR_ACCOUNTS) {
      if (raw.includes(va.account)) {
        vendor = va.vendor;
        vendorAccount = va.account;
        break;
      }
    }
    const scanId = await ctx.db.insert("scans", {
      truckId: args.truckId,
      trackingNumber: args.trackingNumber,
      carrier: args.carrier,
      destination: args.destination,
      recipientName: args.recipientName,
      address: args.address,
      city: args.city,
      state: args.state,
      rawBarcode: args.rawBarcode,
      scannedBy: args.userId,
      scannedAt: Date.now(),
      scanType: args.scanType || "auto",
      vendor,
      vendorAccount,
    });
    const truck = await ctx.db.get(args.truckId);
    if (truck) {
      const scans = await ctx.db
        .query("scans")
        .withIndex("by_truck", (q) => q.eq("truckId", args.truckId))
        .collect();
      await ctx.db.patch(args.truckId, { scanCount: scans.length });
    }
    return scanId;
  },
});

export const closeTruck = mutation({
  args: {
    truckId: v.id("trucks"),
    userId: v.id("users"),
    securityTag: v.string(),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.truckId, {
      status: "closed",
      closedAt: Date.now(),
      closedBy: args.userId,
      securityTag: args.securityTag,
    });
    return { success: true };
  },
});

export const openReturnBatch = mutation({
  args: {
    locationId: v.string(),
    userId: v.id("users"),
  },
  handler: async (ctx, args) => {
    const batchNumber = `RET-${Date.now()}`;
    const batchId = await ctx.db.insert("returnBatches", {
      batchNumber,
      status: "open",
      locationId: args.locationId,
      openedBy: args.userId,
      openedAt: Date.now(),
      itemCount: 0,
    });
    return { success: true, batchId, batchNumber };
  },
});

export const addReturnItem = mutation({
  args: {
    batchId: v.id("returnBatches"),
    userId: v.id("users"),
    poNumber: v.optional(v.string()),
    invNumber: v.optional(v.string()),
    fromAddress: v.optional(v.string()),
    imageUrl: v.optional(v.string()),
    rawText: v.optional(v.string()),
    aiConfidence: v.optional(v.string()),
    upcCode: v.optional(v.string()),
    tireBrand: v.optional(v.string()),
    tireModel: v.optional(v.string()),
    tireSize: v.optional(v.string()),
    quantity: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const batch = await ctx.db.get(args.batchId);
    if (!batch) {
      return { success: false, error: "Batch not found" };
    }
    const itemId = await ctx.db.insert("returnItems", {
      returnBatchId: args.batchId,
      poNumber: args.poNumber,
      invNumber: args.invNumber,
      fromAddress: args.fromAddress,
      imageUrl: args.imageUrl,
      rawText: args.rawText,
      aiConfidence: args.aiConfidence,
      upcCode: args.upcCode,
      tireBrand: args.tireBrand,
      tireModel: args.tireModel,
      tireSize: args.tireSize,
      quantity: args.quantity || 1,
      scannedBy: args.userId,
      scannedAt: Date.now(),
      status: "pending",
    });
    await ctx.db.patch(args.batchId, {
      itemCount: batch.itemCount + (args.quantity || 1),
    });
    return { success: true, itemId };
  },
});

export const closeReturnBatch = mutation({
  args: {
    batchId: v.id("returnBatches"),
    userId: v.id("users"),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.batchId, {
      status: "closed",
      closedAt: Date.now(),
      closedBy: args.userId,
    });
    return { success: true };
  },
});

export const markTruckSynced = mutation({
  args: {
    truckId: v.id("trucks"),
    base44Id: v.string(),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.truckId, {
      base44Id: args.base44Id,
      syncedToBase44: true,
    });
    return { success: true };
  },
});

export const markReturnBatchSynced = mutation({
  args: {
    batchId: v.id("returnBatches"),
    base44Id: v.string(),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.batchId, {
      base44Id: args.base44Id,
    });
    return { success: true };
  },
});

export const upsertUser = mutation({
  args: {
    base44Id: v.string(),
    empId: v.string(),
    name: v.string(),
    pin: v.string(),
    locationId: v.string(),
    locationName: v.string(),
    role: v.optional(v.string()),
    isActive: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("users")
      .withIndex("by_base44Id", (q) => q.eq("base44Id", args.base44Id))
      .first();
    if (existing) {
      await ctx.db.patch(existing._id, {
        empId: args.empId,
        name: args.name,
        pin: args.pin,
        locationId: args.locationId,
        locationName: args.locationName,
        role: args.role,
        isActive: args.isActive ?? true,
      });
      return existing._id;
    }
    const userId = await ctx.db.insert("users", {
      base44Id: args.base44Id,
      empId: args.empId,
      name: args.name,
      pin: args.pin,
      locationId: args.locationId,
      locationName: args.locationName,
      role: args.role,
      isActive: args.isActive ?? true,
    });
    return userId;
  },
});

export const upsertLocation = mutation({
  args: {
    base44Id: v.string(),
    name: v.string(),
    code: v.string(),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("locations")
      .withIndex("by_code", (q) => q.eq("code", args.code))
      .first();
    if (existing) {
      await ctx.db.patch(existing._id, {
        base44Id: args.base44Id,
        name: args.name,
      });
      return existing._id;
    }
    const locationId = await ctx.db.insert("locations", {
      ...args,
      isActive: true,
    });
    return locationId;
  },
});

export const bulkInsertTireUPCs = mutation({
  args: {
    tires: v.array(v.object({
      upc: v.string(),
      brand: v.string(),
      model: v.string(),
      size: v.string(),
      inventoryNumber: v.optional(v.string()),
      auctionTitle: v.optional(v.string()),
    })),
  },
  handler: async (ctx, args) => {
    let inserted = 0;
    for (const tire of args.tires) {
      const existing = await ctx.db
        .query("tireUPCs")
        .withIndex("by_upc", (q) => q.eq("upc", tire.upc))
        .first();
      if (!existing) {
        await ctx.db.insert("tireUPCs", tire);
        inserted++;
      }
    }
    return { inserted, total: args.tires.length };
  },
});

export const backfillVendors = mutation({
  args: {},
  handler: async (ctx) => {
    const scans = await ctx.db.query("scans").collect();
    let updated = 0;
    for (const scan of scans) {
      const raw = scan.rawBarcode || "";
      let vendor = "Unknown";
      let vendorAccount = "";
      for (const va of VENDOR_ACCOUNTS) {
        if (raw.includes(va.account)) {
          vendor = va.vendor;
          vendorAccount = va.account;
          break;
        }
      }
      if (vendor !== "Unknown") {
        await ctx.db.patch(scan._id, { vendor, vendorAccount });
        updated++;
      }
    }
    return { updated, total: scans.length };
  },
});

export const analyzeVendorAccounts = mutation({
  args: {},
  handler: async (ctx) => {
    const scans = await ctx.db.query("scans").collect();
    const accountCounts: Record<string, number> = {};
    for (const scan of scans) {
      const raw = scan.rawBarcode || "";
      const matches = raw.match(/\d{7,9}/g) || [];
      for (const match of matches) {
        if (!accountCounts[match]) accountCounts[match] = 0;
        accountCounts[match]++;
      }
    }
    const sorted = Object.entries(accountCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 50)
      .map(([account, count]) => ({ account, count }));
    return sorted;
  },
});
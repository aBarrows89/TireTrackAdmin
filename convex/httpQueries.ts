import { query } from "./_generated/server";
import { v } from "convex/values";

// Get closed trucks that need to be synced to Base44
export const getUnsyncedTrucks = query({
  args: {},
  handler: async (ctx) => {
    const trucks = await ctx.db
      .query("trucks")
      .filter((q) => 
        q.and(
          q.eq(q.field("status"), "closed"),
          q.eq(q.field("base44Id"), undefined)
        )
      )
      .collect();

    const enrichedTrucks = await Promise.all(
      trucks.map(async (truck) => {
        const scans = await ctx.db
          .query("scans")
          .withIndex("by_truck", (q) => q.eq("truckId", truck._id))
          .collect();

        const openedByUser = await ctx.db.get(truck.openedBy);
        const closedByUser = truck.closedBy
          ? await ctx.db.get(truck.closedBy)
          : null;

        return {
          _id: truck._id,
          truckNumber: truck.truckNumber,
          carrier: truck.carrier,
          status: truck.status,
          locationId: truck.locationId,
          openedAt: truck.openedAt,
          closedAt: truck.closedAt,
          securityTag: truck.securityTag,
          openedByName: openedByUser?.name ?? "Unknown",
          closedByName: closedByUser?.name ?? "Unknown",
          scans: scans.map((s) => ({
            trackingNumber: s.trackingNumber,
            destination: s.destination,
            scannedAt: s.scannedAt,
            scanType: s.scanType || "auto",
        vendor: s.vendor || "Unknown",
          })),
        };
      })
    );

    return enrichedTrucks;
  },
});

// Alias for backward compatibility
export const getPendingTrucks = getUnsyncedTrucks;

// Get truck with full details for Base44 sync
export const getTruckForSync = query({
  args: { truckId: v.id("trucks") },
  handler: async (ctx, args) => {
    const truck = await ctx.db.get(args.truckId);
    if (!truck) return null;

    const scans = await ctx.db
      .query("scans")
      .withIndex("by_truck", (q) => q.eq("truckId", args.truckId))
      .collect();

    const openedByUser = await ctx.db.get(truck.openedBy);
    const closedByUser = truck.closedBy
      ? await ctx.db.get(truck.closedBy)
      : null;

    return {
      _id: truck._id,
      truckNumber: truck.truckNumber,
      carrier: truck.carrier,
      status: truck.status,
      locationId: truck.locationId,
      openedAt: truck.openedAt,
      closedAt: truck.closedAt,
      securityTag: truck.securityTag,
      base44Id: truck.base44Id,
      openedByName: openedByUser?.name ?? "Unknown",
      openedByEmpId: openedByUser?.empId ?? "Unknown",
      closedByName: closedByUser?.name ?? "Unknown",
      closedByEmpId: closedByUser?.empId ?? "Unknown",
      scans: scans.map((s) => ({
        trackingNumber: s.trackingNumber,
        destination: s.destination,
        city: s.city,
        state: s.state,
        recipientName: s.recipientName,
        scannedAt: s.scannedAt,
        scanType: s.scanType || "auto",
        vendor: s.vendor || "Unknown",
      })),
    };
  },
});

// Alias for backward compatibility
export const getTruckWithScans = getTruckForSync;

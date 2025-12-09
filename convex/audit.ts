import { mutation, query, internalMutation } from "./_generated/server";
import { v } from "convex/values";

// Internal mutation to log actions (called from other mutations)
export const logAction = internalMutation({
  args: {
    action: v.string(),
    actionType: v.string(),
    resourceType: v.string(),
    resourceId: v.optional(v.string()),
    adminId: v.optional(v.id("adminUsers")),
    adminEmail: v.optional(v.string()),
    adminName: v.optional(v.string()),
    details: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await ctx.db.insert("auditLogs", {
      ...args,
      timestamp: Date.now(),
    });
  },
});

// Public mutation for logging from the frontend
export const log = mutation({
  args: {
    action: v.string(),
    actionType: v.string(),
    resourceType: v.string(),
    resourceId: v.optional(v.string()),
    adminId: v.optional(v.string()),
    adminEmail: v.optional(v.string()),
    adminName: v.optional(v.string()),
    details: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await ctx.db.insert("auditLogs", {
      action: args.action,
      actionType: args.actionType,
      resourceType: args.resourceType,
      resourceId: args.resourceId,
      adminId: args.adminId as any,
      adminEmail: args.adminEmail,
      adminName: args.adminName,
      details: args.details,
      timestamp: Date.now(),
    });
  },
});

// Get recent audit logs
export const getRecentLogs = query({
  args: {
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const limit = args.limit || 100;
    const logs = await ctx.db
      .query("auditLogs")
      .withIndex("by_timestamp")
      .order("desc")
      .take(limit);

    return logs;
  },
});

// Get logs for a specific admin
export const getLogsByAdmin = query({
  args: {
    adminId: v.id("adminUsers"),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const limit = args.limit || 50;
    const logs = await ctx.db
      .query("auditLogs")
      .withIndex("by_admin", (q) => q.eq("adminId", args.adminId))
      .order("desc")
      .take(limit);

    return logs;
  },
});

// Get logs for a specific resource
export const getLogsByResource = query({
  args: {
    resourceType: v.string(),
    resourceId: v.string(),
  },
  handler: async (ctx, args) => {
    const logs = await ctx.db
      .query("auditLogs")
      .withIndex("by_resource", (q) =>
        q.eq("resourceType", args.resourceType).eq("resourceId", args.resourceId)
      )
      .order("desc")
      .collect();

    return logs;
  },
});

// Get logs filtered by action type
export const getLogsByActionType = query({
  args: {
    actionType: v.string(),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const limit = args.limit || 50;
    const allLogs = await ctx.db
      .query("auditLogs")
      .withIndex("by_timestamp")
      .order("desc")
      .take(500); // Get more and filter

    return allLogs
      .filter(log => log.actionType === args.actionType)
      .slice(0, limit);
  },
});

// Get audit stats
export const getAuditStats = query({
  args: {},
  handler: async (ctx) => {
    const now = Date.now();
    const oneDayAgo = now - 24 * 60 * 60 * 1000;
    const oneWeekAgo = now - 7 * 24 * 60 * 60 * 1000;

    const allLogs = await ctx.db
      .query("auditLogs")
      .withIndex("by_timestamp")
      .order("desc")
      .take(1000);

    const logsToday = allLogs.filter(log => log.timestamp >= oneDayAgo);
    const logsThisWeek = allLogs.filter(log => log.timestamp >= oneWeekAgo);

    // Count by action type
    const actionCounts: Record<string, number> = {};
    for (const log of logsThisWeek) {
      actionCounts[log.actionType] = (actionCounts[log.actionType] || 0) + 1;
    }

    // Get unique admins this week
    const uniqueAdmins = new Set(logsThisWeek.map(log => log.adminEmail).filter(Boolean));

    return {
      totalLogs: allLogs.length,
      logsToday: logsToday.length,
      logsThisWeek: logsThisWeek.length,
      actionCounts,
      uniqueAdminsThisWeek: uniqueAdmins.size,
    };
  },
});

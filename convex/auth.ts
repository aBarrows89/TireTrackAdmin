import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

// Simple hash function (in production, use bcrypt via action)
function simpleHash(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return hash.toString(36) + str.length.toString(36);
}

// Create first superadmin (only works if no admins exist)
export const createFirstAdmin = mutation({
  args: {
    email: v.string(),
    password: v.string(),
    name: v.string(),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db.query("adminUsers").first();
    if (existing) {
      return { success: false, error: "Admin already exists. Use invite flow." };
    }
    
    const adminId = await ctx.db.insert("adminUsers", {
      email: args.email.toLowerCase(),
      passwordHash: simpleHash(args.password),
      name: args.name,
      role: "superadmin",
      allowedLocations: ["all"],
      isActive: true,
      createdAt: Date.now(),
    });
    
    return { success: true, adminId };
  },
});

// Login
export const login = mutation({
  args: {
    email: v.string(),
    password: v.string(),
  },
  handler: async (ctx, args) => {
    const admin = await ctx.db
      .query("adminUsers")
      .withIndex("by_email", (q) => q.eq("email", args.email.toLowerCase()))
      .first();
    
    if (!admin) {
      return { success: false, error: "Invalid credentials" };
    }
    
    if (!admin.isActive) {
      return { success: false, error: "Account deactivated" };
    }
    
    if (admin.passwordHash !== simpleHash(args.password)) {
      return { success: false, error: "Invalid credentials" };
    }
    
    // Update last login
    await ctx.db.patch(admin._id, { lastLoginAt: Date.now() });
    
    // Return user info (token will be created client-side for now)
    return {
      success: true,
      admin: {
        id: admin._id,
        email: admin.email,
        name: admin.name,
        role: admin.role,
        allowedLocations: admin.allowedLocations,
      },
    };
  },
});

// Get current admin by ID
export const getAdmin = query({
  args: { adminId: v.id("adminUsers") },
  handler: async (ctx, args) => {
    const admin = await ctx.db.get(args.adminId);
    if (!admin || !admin.isActive) return null;
    
    return {
      id: admin._id,
      email: admin.email,
      name: admin.name,
      role: admin.role,
      allowedLocations: admin.allowedLocations,
    };
  },
});

// Create new admin (superadmin only)
export const createAdmin = mutation({
  args: {
    email: v.string(),
    password: v.string(),
    name: v.string(),
    role: v.union(v.literal("admin"), v.literal("viewer")),
    allowedLocations: v.array(v.string()),
  },
  handler: async (ctx, args) => {
    // Check if email already exists
    const existing = await ctx.db
      .query("adminUsers")
      .withIndex("by_email", (q) => q.eq("email", args.email.toLowerCase()))
      .first();
    
    if (existing) {
      return { success: false, error: "Email already exists" };
    }
    
    const adminId = await ctx.db.insert("adminUsers", {
      email: args.email.toLowerCase(),
      passwordHash: simpleHash(args.password),
      name: args.name,
      role: args.role,
      allowedLocations: args.allowedLocations,
      isActive: true,
      createdAt: Date.now(),
    });
    
    return { success: true, adminId };
  },
});

// Update admin
export const updateAdmin = mutation({
  args: {
    adminId: v.id("adminUsers"),
    name: v.optional(v.string()),
    role: v.optional(v.union(v.literal("superadmin"), v.literal("admin"), v.literal("viewer"))),
    allowedLocations: v.optional(v.array(v.string())),
    isActive: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const { adminId, ...updates } = args;
    const filteredUpdates = Object.fromEntries(
      Object.entries(updates).filter(([_, v]) => v !== undefined)
    );
    await ctx.db.patch(adminId, filteredUpdates);
    return { success: true };
  },
});

// Change password
export const changePassword = mutation({
  args: {
    adminId: v.id("adminUsers"),
    currentPassword: v.string(),
    newPassword: v.string(),
  },
  handler: async (ctx, args) => {
    const admin = await ctx.db.get(args.adminId);
    if (!admin) {
      return { success: false, error: "Admin not found" };
    }
    
    if (admin.passwordHash !== simpleHash(args.currentPassword)) {
      return { success: false, error: "Current password incorrect" };
    }
    
    await ctx.db.patch(args.adminId, {
      passwordHash: simpleHash(args.newPassword),
    });
    
    return { success: true };
  },
});

// Get all admins (for superadmin management)
export const getAllAdmins = query({
  args: {},
  handler: async (ctx) => {
    const admins = await ctx.db.query("adminUsers").collect();
    return admins.map((a) => ({
      id: a._id,
      email: a.email,
      name: a.name,
      role: a.role,
      allowedLocations: a.allowedLocations,
      isActive: a.isActive,
      createdAt: a.createdAt,
      lastLoginAt: a.lastLoginAt,
    }));
  },
});

// Delete admin
export const deleteAdmin = mutation({
  args: { adminId: v.id("adminUsers") },
  handler: async (ctx, args) => {
    await ctx.db.delete(args.adminId);
    return { success: true };
  },
});

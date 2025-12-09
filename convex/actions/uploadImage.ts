"use node";

import { action } from "../_generated/server";
import { v } from "convex/values";

export const getUploadUrl = action({
  args: {},
  handler: async (ctx): Promise<string> => {
    return await ctx.storage.generateUploadUrl();
  },
});

import { internalMutation } from "./_generated/server";

// Auto-close all open trucks at midnight
export const autoCloseTrucksNightly = internalMutation({
  args: {},
  handler: async (ctx) => {
    const openTrucks = await ctx.db
      .query("trucks")
      .filter((q) => q.eq(q.field("status"), "open"))
      .collect();

    let closed = 0;
    for (const truck of openTrucks) {
      await ctx.db.patch(truck._id, {
        status: "closed",
        closedAt: Date.now(),
      });
      closed++;
    }

    console.log(`[Nightly Auto-Close] Closed ${closed} trucks at ${new Date().toISOString()}`);
    return { closed };
  },
});

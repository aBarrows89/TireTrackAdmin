"use node";

import { action } from "../_generated/server";
import { v } from "convex/values";
import { api } from "../_generated/api";

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

export const syncReturnBatch = action({
  args: {
    batchId: v.id("returnBatches"),
  },
  handler: async (ctx, args): Promise<{ success: boolean; error?: string }> => {
    const batch = await ctx.runQuery(api.queries.getReturnBatch, {
      batchId: args.batchId,
    });

    if (!batch) {
      return { success: false, error: "Batch not found" };
    }

    const items = await ctx.runQuery(api.queries.getReturnItems, {
      batchId: args.batchId,
    });

    try {
      // Create TireReturnBatch in Base44
      const batchData = {
        batch_number: batch.batchNumber,
        status: batch.status,
        location: batch.locationId,
        item_count: items.length,
        opened_at: new Date(batch.openedAt).toISOString(),
        closed_at: batch.closedAt ? new Date(batch.closedAt).toISOString() : null,
        opened_by: batch.openedByName,
      };

      console.log("Creating TireReturnBatch:", batchData);
      const createdBatch = await base44Fetch("/entities/TireReturnBatch", {
        method: "POST",
        body: JSON.stringify(batchData),
      });

      const base44BatchId = createdBatch.id || createdBatch._id;
      console.log("Created batch in Base44:", base44BatchId);

      // Create TireReturnItem for each item
      for (const item of items) {
        const itemData = {
          batch_id: base44BatchId,
          po_number: item.poNumber || "",
          inv_number: item.invNumber || "",
          upc_code: item.upcCode || "",
          tire_brand: item.tireBrand || "",
          tire_model: item.tireModel || "",
          tire_size: item.tireSize || "",
          quantity: item.quantity || 1,
          scan_date: new Date(item.scannedAt).toISOString(),
          scanned_by: item.scannedByName,
          image_url: item.imageUrl || "",
          raw_text: item.rawText || "",
          status: item.status,
        };

        console.log("Creating TireReturnItem:", itemData);
        await base44Fetch("/entities/TireReturnItem", {
          method: "POST",
          body: JSON.stringify(itemData),
        });
      }

      // Mark batch as synced in Convex
      await ctx.runMutation(api.mutations.markReturnBatchSynced, {
        batchId: args.batchId,
        base44Id: base44BatchId,
      });

      return { success: true };
    } catch (error: any) {
      console.error("Base44 sync error:", error);
      return { success: false, error: error.message };
    }
  },
});

"use node";

import { action } from "../_generated/server";
import { v } from "convex/values";

export const parseReturnLabel = action({
  args: {
    imageBase64: v.string(),
  },
  handler: async (ctx, args): Promise<{
    success: boolean;
    poNumber?: string;
    invNumber?: string;
    fromAddress?: string;
    rawText?: string;
    confidence?: string;
    error?: string;
  }> => {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    
    if (!apiKey) {
      return { success: false, error: "API key not configured" };
    }

    try {
      const response = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": apiKey,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          model: "claude-sonnet-4-20250514",
          max_tokens: 256,
          messages: [
            {
              role: "user",
              content: [
                {
                  type: "image",
                  source: {
                    type: "base64",
                    media_type: "image/jpeg",
                    data: args.imageBase64,
                  },
                },
                {
                  type: "text",
                  text: `Look at this shipping label. Find any PO number and INV number.

Return ONLY this JSON, nothing else:
{"po":"NUMBER_OR_NULL","inv":"NUMBER_OR_NULL"}

Examples:
- If you see "PO 12345" return {"po":"12345","inv":null}
- If you see "INV-98765" return {"po":null,"inv":"98765"}
- If you see both return {"po":"12345","inv":"98765"}`,
                },
              ],
            },
          ],
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error("Claude API error:", errorText);
        return { success: false, error: `API error: ${response.status}` };
      }

      const data = await response.json();
      const content = data.content?.[0]?.text;

      if (!content) {
        return { success: false, error: "No response from AI" };
      }

      console.log("AI response:", content);

      try {
        const jsonMatch = content.match(/\{[\s\S]*\}/);
        if (!jsonMatch) {
          return { success: false, error: "Could not parse response" };
        }

        const parsed = JSON.parse(jsonMatch[0]);
        
        return {
          success: true,
          poNumber: parsed.po || undefined,
          invNumber: parsed.inv || undefined,
          confidence: (parsed.po || parsed.inv) ? "high" : "low",
        };
      } catch (parseError) {
        console.error("JSON parse error:", parseError, "Content:", content);
        return { success: false, error: "Could not parse response" };
      }
    } catch (error: any) {
      console.error("parseReturnLabel error:", error);
      return { success: false, error: error.message || "Unknown error" };
    }
  },
});

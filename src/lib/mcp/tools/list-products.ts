import { defineTool, type ToolContext } from "@lovable.dev/mcp-js";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";

function clientFor(ctx: ToolContext) {
  return createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_PUBLISHABLE_KEY!, {
    global: { headers: { Authorization: `Bearer ${ctx.getToken()}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export default defineTool({
  name: "list_products",
  title: "List products",
  description: "List uniform products in Patrichia's Store, optionally filtered by uniform type or in-stock status.",
  inputSchema: {
    type: z.string().optional().describe("Optional uniform type filter, e.g. shirt, trousers, tie, dress."),
    in_stock_only: z.boolean().optional().describe("If true, only return products currently in stock."),
    limit: z.number().int().min(1).max(100).optional().describe("Max rows to return (default 25)."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ type, in_stock_only, limit }, ctx) => {
    if (!ctx.isAuthenticated()) return { content: [{ type: "text", text: "Not authenticated" }], isError: true };
    let q = clientFor(ctx)
      .from("products")
      .select("id, name, type, price, sizes, in_stock, stock_quantity")
      .order("created_at", { ascending: false })
      .limit(limit ?? 25);
    if (type) q = q.eq("type", type);
    if (in_stock_only) q = q.eq("in_stock", true);
    const { data, error } = await q;
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    return {
      content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
      structuredContent: { products: data ?? [] },
    };
  },
});
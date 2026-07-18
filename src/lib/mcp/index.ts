import { auth, defineMcp } from "@lovable.dev/mcp-js";
import listProducts from "./tools/list-products";
import listRecentOrders from "./tools/list-recent-orders";
import listSchools from "./tools/list-schools";

// Direct Supabase issuer required by mcp-js (must match discovery `issuer`).
// Built from the project ref, which Vite inlines at build time.
const projectRef = import.meta.env.VITE_SUPABASE_PROJECT_ID ?? "project-ref-unset";

export default defineMcp({
  name: "patrichia-store-mcp",
  title: "Patrichia's Store MCP",
  version: "0.1.0",
  instructions:
    "Tools for Patrichia's Store: browse products, look up schools, and (for admins) review recent orders. All calls act as the signed-in user; row-level security determines what each caller can read.",
  auth: auth.oauth.issuer({
    issuer: `https://${projectRef}.supabase.co/auth/v1`,
    acceptedAudiences: "authenticated",
  }),
  tools: [listProducts, listRecentOrders, listSchools],
});
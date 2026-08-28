import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");
}

function xmlEscape(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

const SITE_URL = "https://patrichiasstore-url.vercel.app";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // Public SEO URLs only. Operational/admin URLs intentionally never enter the sitemap.
    const [{ data: schools, error: schoolsError }, { data: products, error: productsError }] =
      await Promise.all([
        supabase.from("schools").select("name, updated_at"),
        supabase.from("products").select("id, updated_at, in_stock"),
      ]);

    if (schoolsError) throw schoolsError;
    if (productsError) throw productsError;

    const staticUrls = [
      { loc: `${SITE_URL}/`, priority: "1.0", changefreq: "weekly" },
      { loc: `${SITE_URL}/shop`, priority: "0.9", changefreq: "daily" },
      { loc: `${SITE_URL}/uniform-shop`, priority: "0.9", changefreq: "daily" },
      { loc: `${SITE_URL}/about`, priority: "0.6", changefreq: "monthly" },
      { loc: `${SITE_URL}/contact`, priority: "0.6", changefreq: "monthly" },
    ];

    const schoolUrls = (schools || []).map((s: { name: string; updated_at?: string | null }) => ({
      loc: `${SITE_URL}/uniform-shop/school/${slugify(s.name)}`,
      priority: "0.8",
      changefreq: "weekly",
      lastmod: s.updated_at ? s.updated_at.split("T")[0] : undefined,
    }));

    // Every product has its own public URL. Include out-of-stock products too because
    // their pages remain useful landing pages and can show availability/restocking info.
    const productUrls = (products || []).map((p: { id: string; updated_at?: string | null }) => ({
      loc: `${SITE_URL}/shop/product/${encodeURIComponent(p.id)}`,
      priority: "0.7",
      changefreq: "weekly",
      lastmod: p.updated_at ? p.updated_at.split("T")[0] : undefined,
    }));

    const allUrls = [...staticUrls, ...schoolUrls, ...productUrls];

    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${allUrls
  .map(
    (u) => `  <url>\n    <loc>${xmlEscape(u.loc)}</loc>\n    <changefreq>${u.changefreq}</changefreq>\n    <priority>${u.priority}</priority>${u.lastmod ? `\n    <lastmod>${u.lastmod}</lastmod>` : ""}\n  </url>`
  )
  .join("\n")}
</urlset>`;

    return new Response(xml, {
      headers: {
        ...corsHeaders,
        "Content-Type": "application/xml; charset=UTF-8",
        // Keep the sitemap fresh when schools/products are added or edited.
        "Cache-Control": "public, max-age=900, s-maxage=900",
      },
    });
  } catch (err) {
    console.error("Sitemap generation error:", err);
    return new Response("Error generating sitemap", {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "text/plain; charset=UTF-8" },
    });
  }
});

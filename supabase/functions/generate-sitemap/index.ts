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

    const { data: schools, error } = await supabase
      .from("schools")
      .select("name, updated_at");

    if (error) throw error;

    const staticUrls = [
      { loc: `${SITE_URL}/`, priority: "1.0", changefreq: "weekly" },
      { loc: `${SITE_URL}/shop`, priority: "0.9", changefreq: "daily" },
      { loc: `${SITE_URL}/uniform-shop`, priority: "0.9", changefreq: "daily" },
      { loc: `${SITE_URL}/about`, priority: "0.6", changefreq: "monthly" },
      { loc: `${SITE_URL}/contact`, priority: "0.6", changefreq: "monthly" },
    ];

    const schoolUrls = (schools || []).map((s: { name: string; updated_at: string }) => ({
      loc: `${SITE_URL}/uniform-shop/school/${slugify(s.name)}`,
      priority: "0.8",
      changefreq: "weekly",
      lastmod: s.updated_at ? s.updated_at.split("T")[0] : undefined,
    }));

    const allUrls = [...staticUrls, ...schoolUrls];

    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${allUrls
  .map(
    (u) => `  <url>
    <loc>${u.loc}</loc>
    <changefreq>${u.changefreq}</changefreq>
    <priority>${u.priority}</priority>${u.lastmod ? `\n    <lastmod>${u.lastmod}</lastmod>` : ""}
  </url>`
  )
  .join("\n")}
</urlset>`;

    return new Response(xml, {
      headers: {
        ...corsHeaders,
        "Content-Type": "application/xml",
        "Cache-Control": "public, max-age=3600",
      },
    });
  } catch (err) {
    console.error("Sitemap generation error:", err);
    return new Response("Error generating sitemap", { status: 500, headers: corsHeaders });
  }
});

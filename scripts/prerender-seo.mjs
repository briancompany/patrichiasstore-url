import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const SITE = "https://patrichiasstore-url.vercel.app";
const DB = process.env.VITE_SUPABASE_URL || "https://jkdxlbkckpwzmhdaoaoo.supabase.co";
const KEY = process.env.VITE_SUPABASE_PUBLISHABLE_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdWIiLCJyZWYiOiJqa2R4bGJrY2twd3ptaGRhb2FvbyIsInJvbGUiOiJhbm9uIiwiaWF0IjoxNzY4NDc2MDcsImV4cCI6MjA4NDA0ODYwMH0.invalid";
const DIST = path.resolve("dist");

const esc = (v) => String(v ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
const slug = (v) => v.toLowerCase().trim().replace(/[^\w\s-]/g, "").replace(/\s+/g, "-").replace(/-+/g, "-");
const sizes = (v) => { if (Array.isArray(v)) return v; try { const x = JSON.parse(v || "[]"); return Array.isArray(x) ? x : []; } catch { return []; } };
const cash = (v) => Number(v).toLocaleString("en-KE");

async function rows(table, select, order) {
  const all = [];
  for (let offset = 0; ; offset += 1000) {
    const url = new URL(DB + "/rest/v1/" + table);
    url.searchParams.set("select", select);
    url.searchParams.set("order", order);
    url.searchParams.set("limit", "1000");
    url.searchParams.set("offset", String(offset));
    const res = await fetch(url, { headers: { apikey: KEY, Authorization: "Bearer " + KEY } });
    if (!res.ok) throw new Error("SEO prerender could not read " + table + ": HTTP " + res.status);
    const page = await res.json();
    all.push(...page);
    if (page.length < 1000) return all;
  }
}
function meta(html, key, value, property = false) {
  const attr = property ? "property" : "name";
  const pattern = new RegExp("<meta(?=[^>]*\\\\b" + attr + "=[\\"']" + key + "[\\"'])[^>]*>", "i");
  const tag = '<meta ' + attr + '="' + key + '" content="' + esc(value) + '" />';
  return pattern.test(html) ? html.replace(pattern, tag) : html.replace("</head>", tag + "\\n</head>");
}
function render(template, data) {
  let html = template.replace(/<title>[^<]*<\\/title>/i, "<title>" + esc(data.title) + "</title>");
  html = meta(html, "description", data.description);
  html = meta(html, "robots", "index, follow, max-image-preview:large");
  html = meta(html, "og:title", data.title, true);
  html = meta(html, "og:description", data.description, true);
  html = meta(html, "og:url", data.url, true);
  html = meta(html, "og:type", data.type || "website", true);
  html = meta(html, "og:image", data.image || SITE + "/og-image.jpg", true);
  html = meta(html, "twitter:title", data.title);
  html = meta(html, "twitter:description", data.description);
  html = html.replace(/<link\\s+rel=["']canonical["'][^>]*>/gi, "");
  html = html.replace("</head>", '<link rel="canonical" href="' + esc(data.url) + '" />\\n<script type="application/ld+json">' + JSON.stringify(data.schema).replace(/</g, "\\\\u003c") + "</script>\\n</head>");
  return html.replace('<div id="root"></div>', '<div id="root">' + data.body + "</div>");
}
async function writePage(route, html) {
  const file = path.join(DIST, route, "index.html");
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, html, "utf8");
}
function storeInfo() {
  return '<section><h2>Visit Patrichia Kavingo Uniform Store</h2><p>Uhuru Market, Store F47, Jogoo Road, Nairobi. Open Monday to Saturday, 8am–6pm.</p><p>Call or WhatsApp <a href="tel:+254726075180">+254 726 075 180</a> for sizing, availability, pickup and countrywide delivery.</p></section>';
}
function card(p, schoolName) {
  const prices = sizes(p.sizes).map((x) => Number(x.price)).filter(Number.isFinite);
  const price = prices.length ? "<p>From KES " + cash(Math.min(...prices)) + "</p>" : "";
  return '<article><a href="/shop/product/' + encodeURIComponent(p.id) + '">' +
    (p.image_url ? '<img src="' + esc(p.image_url) + '" alt="' + esc(p.name) + '" width="320" height="320" loading="lazy" />' : "") +
    "<h2>" + esc((schoolName ? schoolName + " " : "") + p.name) + "</h2></a><p>" + esc(p.type || "School uniform") +
    "</p>" + price + "<p>" + (p.in_stock ? "Listed as in stock" : "Currently out of stock — contact us to confirm availability") + "</p></article>";
}

const template = await readFile(path.join(DIST, "index.html"), "utf8");
const [schools, products] = await Promise.all([
  rows("schools", "id,name,logo_url,updated_at", "name.asc"),
  rows("products", "id,school_id,name,type,description,image_url,sizes,in_stock,updated_at", "id.asc"),
]);
const schoolById = new Map(schools.map((s) => [s.id, s]));
const bySchool = new Map();
for (const p of products) {
  if (p.school_id) bySchool.set(p.school_id, (bySchool.get(p.school_id) || []).concat(p));
}
const urls = new Map();
const addUrl = (url, updated) => urls.set(url, updated || urls.get(url) || null);
[ "/", "/shop", "/uniform-shop", "/about", "/contact" ].forEach((p) => addUrl(SITE + p));

const schoolLinks = [];
const seen = new Set();
for (const s of schools) {
  const slugValue = slug(s.name);
  if (!slugValue || seen.has(slugValue)) {
    console.warn("SEO prerender skipped duplicate school slug: " + s.name);
    continue;
  }
  seen.add(slugValue);
  const url = SITE + "/uniform-shop/school/" + slugValue;
  const related = bySchool.get(s.id) || [];
  const title = s.name + " School Uniforms in Nairobi | Patrichia Kavingo Store";
  const description = "Find " + s.name + " school uniforms at Patrichia Kavingo Store, Uhuru Market Store F47, Jogoo Road, Nairobi. Check listed items, sizes and prices or contact us for help.";
  const productList = related.length ? related.map((p) => card(p, s.name)).join("") :
    "<p>Looking for " + esc(s.name) + " uniforms? Contact our store for help checking available items, sizes and current prices.</p>";
  const body = '<main><nav><a href="/">Home</a> / <a href="/uniform-shop">School uniforms</a></nav><h1>' + esc(s.name) +
    ' School Uniforms</h1><p>Browse listed uniform items for ' + esc(s.name) +
    ' or contact our Nairobi store for help with school uniform requirements, sizes and current prices.</p>' +
    (s.logo_url ? '<img src="' + esc(s.logo_url) + '" alt="' + esc(s.name) + ' school logo" width="120" height="120" />' : "") +
    "<section><h2>Uniform items for " + esc(s.name) + "</h2>" + productList + "</section>" + storeInfo() +
    '<p><a href="/uniform-shop">Find another school</a> · <a href="/shop">Browse all products</a></p></main>';
  const schema = { "@context": "https://schema.org", "@type": "WebPage", name: title, description, url,
    about: { "@type": "EducationalOrganization", name: s.name },
    breadcrumb: { "@type": "BreadcrumbList", itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: SITE + "/" },
      { "@type": "ListItem", position: 2, name: "School Uniforms", item: SITE + "/uniform-shop" },
      { "@type": "ListItem", position: 3, name: s.name + " Uniforms", item: url }
    ] } };
  await writePage("uniform-shop/school/" + slugValue, render(template, { title, description, url, body, schema, image: s.logo_url }));
  schoolLinks.push('<li><a href="/uniform-shop/school/' + slugValue + '">' + esc(s.name) + ' uniforms</a></li>');
  addUrl(url, s.updated_at);
}

for (const p of products) {
  const school = p.school_id ? schoolById.get(p.school_id) : null;
  const schoolName = school ? school.name : "";
  const prices = sizes(p.sizes).map((x) => Number(x.price)).filter(Number.isFinite);
  const lowest = prices.length ? Math.min(...prices) : null;
  const title = (schoolName ? schoolName + " " : "") + p.name + " | School Uniform | Patrichia Kavingo Store";
  const description = "Buy " + (schoolName ? schoolName + " " : "") + p.name + " in Nairobi from Patrichia Kavingo Store, Uhuru Market Store F47, Jogoo Road." +
    (lowest !== null ? " From KES " + cash(lowest) + "." : "") + " Call +254 726 075 180 for sizes and availability.";
  const url = SITE + "/shop/product/" + encodeURIComponent(p.id);
  const sizeList = sizes(p.sizes);
  const sizeMarkup = sizeList.length ? "<h2>Available sizes and prices</h2><ul>" +
    sizeList.map((x) => "<li>" + esc(x.size) + " — KES " + cash(x.price) + "</li>").join("") + "</ul>" : "";
  const body = '<main><nav><a href="/">Home</a> / <a href="/shop">Shop</a>' +
    (school ? ' / <a href="/uniform-shop/school/' + slug(school.name) + '">' + esc(school.name) + ' uniforms</a>' : "") +
    "</nav><h1>" + esc((schoolName ? schoolName + " " : "") + p.name) + "</h1>" +
    (p.image_url ? '<img src="' + esc(p.image_url) + '" alt="' + esc(p.name) + '" width="640" height="640" />' : "") +
    "<p>" + esc(p.description || (p.name + " school uniform available from Patrichia Kavingo Store in Nairobi.")) + "</p>" +
    "<p>Category: " + esc(p.type || "Uniform") + "</p>" +
    (lowest !== null ? "<p>From KES " + cash(lowest) + "</p>" : "<p>Contact the store for current pricing.</p>") +
    sizeMarkup + "<p>" + (p.in_stock ? "Listed as in stock." : "Currently listed as out of stock. Contact us to confirm availability.") +
    "</p>" + storeInfo() + '<p><a href="/shop">Browse more uniforms</a></p></main>';
  const schema = { "@context": "https://schema.org", "@type": "Product", name: (schoolName ? schoolName + " " : "") + p.name,
    description: p.description || description, sku: p.id, ...(p.image_url ? { image: [p.image_url] } : {}),
    ...(schoolName ? { brand: { "@type": "Brand", name: schoolName } } : {}),
    offers: { "@type": "Offer", url, priceCurrency: "KES", ...(lowest !== null ? { price: lowest } : {}),
      availability: p.in_stock ? "https://schema.org/InStock" : "https://schema.org/OutOfStock",
      seller: { "@type": "ClothingStore", name: "Patrichia Kavingo Uniform Store", url: SITE } } };
  await writePage("shop/product/" + p.id, render(template, { title, description, url, body, schema, image: p.image_url, type: "product" }));
  addUrl(url, p.updated_at);
}

const schoolBody = '<main><h1>School Uniforms in Nairobi and Kenya</h1><p>Browse school uniform pages by school name. Patrichia Kavingo Uniform Store is at Uhuru Market, Store F47, Jogoo Road, Nairobi.</p><ul>' +
  schoolLinks.join("") + "</ul>" + storeInfo() + "</main>";
const productBody = '<main><h1>Shop School Uniforms</h1><p>Browse school uniforms, tracksuits, shirts, trousers, skirts and accessories.</p><ul>' +
  products.map((p) => '<li><a href="/shop/product/' + encodeURIComponent(p.id) + '">' + esc(p.name) +
    (p.school_id && schoolById.has(p.school_id) ? " — " + esc(schoolById.get(p.school_id).name) : "") + "</a></li>").join("") +
  "</ul>" + storeInfo() + "</main>";
await writePage("uniform-shop", render(template, { title: "School Uniforms for Kenyan Schools | Patrichia Kavingo Store",
  description: "Browse school uniform pages and find uniforms for schools across Kenya at Patrichia Kavingo Store, Uhuru Market Store F47, Nairobi.",
  url: SITE + "/uniform-shop", body: schoolBody, schema: { "@context": "https://schema.org", "@type": "CollectionPage", name: "School Uniforms", url: SITE + "/uniform-shop" } }));
await writePage("shop", render(template, { title: "Shop School Uniforms and Tracksuits in Nairobi | Patrichia Kavingo Store",
  description: "Browse school uniforms, tracksuits, shirts, trousers, skirts and accessories at Patrichia Kavingo Store, Uhuru Market, Nairobi.",
  url: SITE + "/shop", body: productBody, schema: { "@context": "https://schema.org", "@type": "CollectionPage", name: "School Uniform Shop", url: SITE + "/shop" } }));

const xml = '<?xml version="1.0" encoding="UTF-8"?>\\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\\n' +
  [...urls].map(([url, updated]) => "  <url><loc>" + esc(url) + "</loc>" +
    (updated ? "<lastmod>" + esc(String(updated).slice(0, 10)) + "</lastmod>" : "") + "</url>").join("\\n") +
  "\\n</urlset>\\n";
await writeFile(path.join(DIST, "sitemap.xml"), xml, "utf8");
console.log("SEO prerender complete: " + schools.length + " schools, " + products.length + " products, " + urls.size + " sitemap URLs.");

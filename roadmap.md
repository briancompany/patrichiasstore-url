# Two-issue build: Performance → Google indexing

## Issue 1 — Performance (first)
- [ ] Viewport: remove maximum-scale=1.0 / user-scalable=no (keep reflow rules)
- [ ] Images: convert/compress to WebP at display size, explicit width/height, lazy-load below fold, preload LCP hero
- [ ] Reserve space (aspect-ratio) + skeletons for dynamic content
- [ ] Code splitting / trim initial JS
- [ ] DB indexes: products(school_id,type,in_stock), schools(name), orders(customer_phone,status), visitor_events(created_at,visitor_id,event_type)
- [ ] Replace sequential Supabase queries with Promise.all; session-level caching
- [ ] Cache headers for static assets (vercel.json)

## Issue 2 — Google indexing (second)
- [ ] react-helmet-async on SchoolUniformPage + ProductPage (title/description/canonical/JSON-LD)
- [ ] Build-time prerender of school + product pages with real static HTML
- [ ] uniform-shop static HTML with plain anchor links to all schools
- [ ] Fix generate-sitemap: shared slugify, public indexable URLs only
- [ ] robots.txt: add /wishlist and /.lovable/*
- [ ] LocalBusiness/WebSite JSON-LD static on homepage; Product JSON-LD on product pages
- [ ] Verify raw HTML (page source) on 5 school pages

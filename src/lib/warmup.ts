/**
 * Edge function warm-up — fires on app load to prevent cold starts.
 * Uses GET with anon key headers instead of raw OPTIONS (which fail CORS preflight).
 */
let _warmedUp = false;

export function warmupEdgeFunctions() {
  if (_warmedUp) return;
  _warmedUp = true;

  const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
  const anonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
  if (!projectId || !anonKey) return;

  const base = `https://${projectId}.supabase.co/functions/v1`;
  const headers: HeadersInit = {
    'apikey': anonKey,
    'Authorization': `Bearer ${anonKey}`,
    'Content-Type': 'application/json',
  };

  // Fire-and-forget warm-up pings — health-check is GET, others POST with warmup flag
  fetch(`${base}/health-check`, { method: 'GET', headers }).catch(() => {});

  // For payment functions, send a minimal warmup body so they boot without doing real work
  ['confirm-payment', 'pesapal-pay'].forEach((fn) => {
    fetch(`${base}/${fn}`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ warmup: true }),
    }).catch(() => {});
  });
}

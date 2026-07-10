/**
 * Edge function warm-up — fires on app load to prevent cold starts.
 * Uses GET with anon key headers instead of raw OPTIONS (which fail CORS preflight).
 */
let _warmedUp = false;

const FALLBACK_PROJECT_ID = "jkdxlbkckpwzmhdaoaoo";
const FALLBACK_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImprZHhsYmtja3B3em1oZGFvYW9vIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njg0NzI2MDcsImV4cCI6MjA4NDA0ODYwN30.u7hEkXp0wsNBm8dGzMhq1AsPCdMWdte1_6PziiLFyOI";

function isValidAnonKey(key: string | undefined) {
  if (!key) return false;

  try {
    const [, payload] = key.split('.');
    if (!payload) return false;
    const normalizedPayload = payload.replace(/-/g, '+').replace(/_/g, '/');
    const decodedPayload = JSON.parse(
      atob(normalizedPayload.padEnd(Math.ceil(normalizedPayload.length / 4) * 4, '=')),
    );

    return decodedPayload.ref === FALLBACK_PROJECT_ID && decodedPayload.role === 'anon';
  } catch {
    return false;
  }
}

export function warmupEdgeFunctions() {
  if (_warmedUp) return;
  _warmedUp = true;

  const projectId =
    import.meta.env.VITE_SUPABASE_PROJECT_ID === FALLBACK_PROJECT_ID
      ? import.meta.env.VITE_SUPABASE_PROJECT_ID
      : FALLBACK_PROJECT_ID;
  const anonKey = isValidAnonKey(import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY)
    ? import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY
    : FALLBACK_ANON_KEY;
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
  ['confirm-payment', 'pesapal-pay', 'staff-login'].forEach((fn) => {
    fetch(`${base}/${fn}`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ warmup: true }),
    }).catch(() => {});
  });
}

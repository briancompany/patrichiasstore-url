/**
 * Edge function warm-up — fires on app load to prevent cold starts
 * on critical payment/order paths.
 */
const WARMUP_FUNCTIONS = [
  'health-check',
  'pesapal-pay',
  'confirm-payment',
];

let _warmedUp = false;

export function warmupEdgeFunctions() {
  if (_warmedUp) return;
  _warmedUp = true;

  const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
  if (!projectId) return;

  const base = `https://${projectId}.supabase.co/functions/v1`;

  // Fire-and-forget warm-up pings (no await, no blocking)
  WARMUP_FUNCTIONS.forEach((fn) => {
    fetch(`${base}/${fn}`, {
      method: fn === 'health-check' ? 'GET' : 'OPTIONS',
      headers: { 'Content-Type': 'application/json' },
    }).catch(() => {});
  });
}

import { supabase } from '@/integrations/supabase/client';

export type LogSeverity = 'info' | 'warning' | 'error' | 'critical';

export interface ServerLogRow {
  id: string;
  occurred_at: string;
  severity: LogSeverity;
  event_type: string;
  message: string;
  endpoint: string | null;
  method: string | null;
  status_code: number | null;
  response_time_ms: number | null;
  ip_address: string | null;
  user_id: string | null;
  user_email: string | null;
  source: string;
  meta: Record<string, unknown> | null;
}

const SENSITIVE_KEYS = [
  'password', 'pass', 'pwd', 'token', 'access_token', 'refresh_token', 'jwt',
  'apikey', 'api_key', 'secret', 'authorization', 'auth', 'cookie',
  'card', 'card_number', 'cvv', 'pin', 'mpesa_code', 'payment_code',
  'phone', 'account', 'iban',
];

/** Mask an email so logs never carry a full private address. */
export function maskEmail(email: string): string {
  const [local, domain] = email.split('@');
  if (!domain) return '***';
  const head = local.slice(0, 1);
  return `${head}${'*'.repeat(Math.max(2, local.length - 1))}@${domain}`;
}

/** Remove secrets/PII from free text before it is stored or displayed. */
export function sanitizeLogText(text: string): string {
  return text
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, (m) => maskEmail(m))
    .replace(/\b(?:\+?254|0)7\d{8}\b/g, '07******')
    .replace(/\b[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\b/g, '[redacted-token]')
    .replace(/(password|token|secret|apikey|api_key|authorization)\s*[:=]\s*\S+/gi, '$1=[redacted]')
    .slice(0, 500);
}

/** Drop sensitive keys and stringify safely. */
export function sanitizeLogMeta(meta?: Record<string, unknown>): Record<string, unknown> {
  if (!meta) return {};
  const out: Record<string, unknown> = {};
  Object.entries(meta).forEach(([key, value]) => {
    if (SENSITIVE_KEYS.includes(key.toLowerCase())) return;
    if (value === null || value === undefined) return;
    if (typeof value === 'string') out[key] = sanitizeLogText(value);
    else if (typeof value === 'number' || typeof value === 'boolean') out[key] = value;
    else out[key] = sanitizeLogText(JSON.stringify(value));
  });
  return out;
}

export interface LogEventInput {
  eventType: string;
  message: string;
  severity?: LogSeverity;
  endpoint?: string;
  method?: string;
  statusCode?: number;
  responseTimeMs?: number;
  meta?: Record<string, unknown>;
}

// Suppress identical bursts so one broken loop can't flood the log table.
const recent = new Map<string, number>();
const DEDUPE_MS = 4000;

/** Record a monitoring event. Never throws — logging must not break the app. */
export async function logServerEvent(input: LogEventInput): Promise<void> {
  try {
    const key = `${input.eventType}|${input.message}|${input.statusCode ?? ''}`;
    const now = Date.now();
    const last = recent.get(key);
    if (last && now - last < DEDUPE_MS) return;
    recent.set(key, now);
    if (recent.size > 200) recent.clear();

    await supabase.rpc('log_server_event', {
      _event_type: input.eventType,
      _message: sanitizeLogText(input.message),
      _severity: input.severity ?? 'info',
      _endpoint: input.endpoint ?? (typeof window !== 'undefined' ? window.location.pathname : null),
      _method: input.method ?? null,
      _status_code: input.statusCode ?? null,
      _response_time_ms: input.responseTimeMs ?? null,
      _meta: sanitizeLogMeta(input.meta) as never,
    });
  } catch {
    // Monitoring is best-effort only.
  }
}

/** Authentication events (successes, denials, lockouts). */
export function logAuthEvent(
  message: string,
  severity: LogSeverity = 'info',
  meta?: Record<string, unknown>,
) {
  return logServerEvent({ eventType: 'auth', message, severity, meta });
}

/** Failed sign-in attempt. */
export function logFailedLogin(email: string, reason: string, attempts?: number) {
  return logServerEvent({
    eventType: 'auth_failed',
    message: `Failed sign-in for ${maskEmail(email)}: ${reason}`,
    severity: (attempts ?? 0) >= 3 ? 'critical' : 'warning',
    statusCode: 401,
    meta: { attempts: attempts ?? 1, reason },
  });
}

/** API / database / edge function error. */
export function logApiError(
  endpoint: string,
  message: string,
  statusCode?: number,
  responseTimeMs?: number,
) {
  return logServerEvent({
    eventType: statusCode && statusCode >= 500 ? 'server_error' : 'api_error',
    message,
    severity: statusCode && statusCode >= 500 ? 'error' : 'warning',
    endpoint,
    statusCode,
    responseTimeMs,
  });
}

/** Security-relevant event (suspicious traffic, blocked attack, test run). */
export function logSecurityEvent(
  message: string,
  severity: LogSeverity = 'warning',
  meta?: Record<string, unknown>,
) {
  return logServerEvent({ eventType: 'security', message, severity, meta });
}

/** Time a network call and log slow or failing requests. */
export async function withRequestLogging<T>(
  label: string,
  endpoint: string,
  run: () => Promise<T>,
  slowMs = 2500,
): Promise<T> {
  const start = Date.now();
  try {
    const result = await run();
    const elapsed = Date.now() - start;
    if (elapsed >= slowMs) {
      await logServerEvent({
        eventType: 'slow_request',
        message: `${label} took ${elapsed}ms`,
        severity: 'warning',
        endpoint,
        responseTimeMs: elapsed,
        statusCode: 200,
      });
    }
    return result;
  } catch (error) {
    const elapsed = Date.now() - start;
    await logServerEvent({
      eventType: 'request_failed',
      message: `${label} failed: ${error instanceof Error ? error.message : 'unknown error'}`,
      severity: 'error',
      endpoint,
      statusCode: 500,
      responseTimeMs: elapsed,
    });
    throw error;
  }
}

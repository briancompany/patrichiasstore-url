/**
 * Security utilities: rate limiting, input sanitization, and audit logging.
 */

// ─── Rate Limiter ─────────────────────────────────────────────
interface RateLimitEntry {
  count: number;
  firstRequest: number;
}

const rateLimitStore = new Map<string, RateLimitEntry>();

/**
 * Client-side rate limiter. Returns true if the action is allowed.
 * @param key   Unique key for the action (e.g. "login", "payment")
 * @param maxRequests  Max requests allowed in the window
 * @param windowMs    Time window in milliseconds
 */
export function rateLimit(key: string, maxRequests: number, windowMs: number): boolean {
  const now = Date.now();
  const entry = rateLimitStore.get(key);

  if (!entry || now - entry.firstRequest > windowMs) {
    rateLimitStore.set(key, { count: 1, firstRequest: now });
    return true;
  }

  if (entry.count >= maxRequests) {
    return false;
  }

  entry.count++;
  return true;
}

/**
 * Returns seconds remaining until rate limit resets, or 0 if not limited.
 */
export function rateLimitTimeRemaining(key: string, windowMs: number): number {
  const entry = rateLimitStore.get(key);
  if (!entry) return 0;
  const elapsed = Date.now() - entry.firstRequest;
  if (elapsed > windowMs) return 0;
  return Math.ceil((windowMs - elapsed) / 1000);
}

// ─── Input Sanitization ───────────────────────────────────────

/**
 * Strip HTML tags and trim whitespace from user input.
 */
export function sanitizeText(input: string): string {
  return input
    .replace(/<[^>]*>/g, '')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/<[^>]*>/g, '') // second pass after entity decode
    .trim();
}

/**
 * Validate and sanitize a phone number (Kenya format).
 */
export function sanitizePhone(phone: string): string {
  return phone.replace(/[^\\d+]/g, '').trim();
}

/**
 * Validate email format.
 */
export function isValidEmail(email: string): boolean {
  return /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i.test(email.trim());
}

/**
 * Sanitize an M-Pesa/payment code: uppercase, alphanumeric only.
 */
export function sanitizePaymentCode(code: string): string {
  return code.toUpperCase().replace(/[^A-Z0-9]/g, '').trim();
}

/**
 * Validate a tracking code format (PS-XXXXXX).
 */
export function isValidTrackingCode(code: string): boolean {
  const cleaned = code.toUpperCase().trim();
  return /^(PS-)?[A-Z0-9]{6,10}$/.test(cleaned);
}

// ─── Audit Logger (client-side, stores in sessionStorage for admin review) ───

export interface AuditEntry {
  id: string;
  action: string;
  detail: string;
  timestamp: string;
  severity: 'info' | 'warning' | 'critical';
}

const AUDIT_KEY = 'ps_audit_log';
const MAX_AUDIT_ENTRIES = 200;

export function logAuditEvent(
  action: string,
  detail: string,
  severity: AuditEntry['severity'] = 'info'
): void {
  try {
    const entries: AuditEntry[] = JSON.parse(sessionStorage.getItem(AUDIT_KEY) || '[]');
    entries.unshift({
      id: crypto.randomUUID?.() || Date.now().toString(36),
      action,
      detail,
      timestamp: new Date().toISOString(),
      severity,
    });
    // Keep only the latest entries
    sessionStorage.setItem(AUDIT_KEY, JSON.stringify(entries.slice(0, MAX_AUDIT_ENTRIES)));
  } catch {
    // sessionStorage may be unavailable
  }
}

export function getAuditLog(): AuditEntry[] {
  try {
    return JSON.parse(sessionStorage.getItem(AUDIT_KEY) || '[]');
  } catch {
    return [];
  }
}

export function clearAuditLog(): void {
  try {
    sessionStorage.removeItem(AUDIT_KEY);
  } catch {
    // noop
  }
}

// ─── Suspicious Activity Detection ───────────────────────────

const suspiciousCounters = new Map<string, { count: number; window: number }>();

/**
 * Track an action and return true if it's suspicious (exceeds threshold).
 */
export function detectSuspiciousActivity(
  action: string,
  threshold: number = 10,
  windowMs: number = 60_000
): boolean {
  const now = Date.now();
  const entry = suspiciousCounters.get(action);

  if (!entry || now - entry.window > windowMs) {
    suspiciousCounters.set(action, { count: 1, window: now });
    return false;
  }

  entry.count++;
  if (entry.count > threshold) {
    logAuditEvent(
      'SUSPICIOUS_ACTIVITY',
      `Action "${action}" exceeded ${threshold} requests in ${windowMs / 1000}s (count: ${entry.count})`,
      'critical'
    );
    return true;
  }

  return false;
}

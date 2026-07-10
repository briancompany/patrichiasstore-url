/**
 * Normalize Kenyan phone numbers to international format (254XXXXXXXXX).
 */
export function normalizePhone(input: string): string {
  const digits = String(input || "").replace(/[^0-9+]/g, "");
  if (digits.startsWith("+254")) return digits.slice(1);
  if (digits.startsWith("254")) return digits;
  if (digits.startsWith("0")) return "254" + digits.slice(1);
  if (digits.startsWith("7") || digits.startsWith("1")) return "254" + digits;
  return digits;
}

export function isValidKePhone(phone: string): boolean {
  const n = normalizePhone(phone);
  return /^254(7|1)\d{8}$/.test(n);
}
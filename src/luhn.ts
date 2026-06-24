/**
 * Luhn checksum. Used only to confirm that designated card *test* numbers pass
 * the same validation a real card would — which is exactly why they sit in the
 * `designated-test-only` tier and not `provably-non-real`: passing Luhn is the
 * point, so the value is valid-looking, not impossible.
 */
export function luhnValid(digits: string): boolean {
  if (!/^\d+$/.test(digits)) return false;
  let sum = 0;
  let double = false;
  for (let i = digits.length - 1; i >= 0; i--) {
    let d = digits.charCodeAt(i) - 48;
    if (double) {
      d *= 2;
      if (d > 9) d -= 9;
    }
    sum += d;
    double = !double;
  }
  return sum % 10 === 0;
}

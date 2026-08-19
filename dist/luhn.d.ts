/**
 * Luhn checksum. Used only to confirm that designated card *test* numbers pass
 * the same validation a real card would — which is exactly why they sit in the
 * `designated-test-only` tier and not `protocol-reserved`: passing Luhn is the
 * point, so the value is valid-looking, not impossible.
 */
export declare function luhnValid(digits: string): boolean;
//# sourceMappingURL=luhn.d.ts.map
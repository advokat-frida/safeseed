/**
 * Isomorphic SHA-256 over the Web Crypto API.
 *
 * `crypto.subtle` is provided by the platform in both modern Node (>=18) and
 * browsers, so SafeSeed needs no hashing dependency to bundle or audit. The hash
 * is used for the *tamper-evident run record* — it proves a file is byte-for-byte
 * the one that was generated, not that the file is free of personal data.
 */
export async function sha256Hex(input: string): Promise<string> {
  const bytes = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

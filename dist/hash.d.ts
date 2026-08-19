/**
 * Isomorphic SHA-256 over the Web Crypto API.
 *
 * `crypto.subtle` is provided by the platform in both supported Node (>=22) and
 * browsers, so SafeSeed needs no hashing dependency to bundle or audit. The hash
 * is used for the unsigned integrity record. Against an independently protected
 * record, it detects whether a file is byte-for-byte the recorded one; alone, it
 * authenticates neither origin nor whether the file is free of personal data.
 */
export declare function sha256Hex(input: string): Promise<string>;
//# sourceMappingURL=hash.d.ts.map
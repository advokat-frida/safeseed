/**
 * IP address membership helpers, so the catalog can say "this value is inside a
 * standards-reserved block" precisely rather than by string prefix.
 */
/** Parse a dotted-quad IPv4 string to an unsigned 32-bit int, or null if invalid. */
export declare function ipv4ToInt(ip: string): number | null;
/** True if `ip` falls inside the given IPv4 CIDR block (e.g. "192.0.2.0/24"). */
export declare function ipv4InCidr(ip: string, cidr: string): boolean;
/**
 * Expand an IPv6 string to its 8 hextets (numbers), handling a single "::"
 * abbreviation and an optional zone id. Returns null if malformed.
 */
export declare function expandIpv6(ip: string): number[] | null;
/** True if `ip` falls inside the given IPv6 prefix (e.g. "2001:db8::/32"). */
export declare function ipv6InPrefix(ip: string, prefixCidr: string): boolean;
//# sourceMappingURL=net.d.ts.map
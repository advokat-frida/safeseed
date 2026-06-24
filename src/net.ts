/**
 * IP address membership helpers, so the catalog can say "this value is inside a
 * standards-reserved block" precisely rather than by string prefix.
 */

/** Parse a dotted-quad IPv4 string to an unsigned 32-bit int, or null if invalid. */
export function ipv4ToInt(ip: string): number | null {
  const parts = ip.split(".");
  if (parts.length !== 4) return null;
  let n = 0;
  for (const p of parts) {
    if (!/^\d{1,3}$/.test(p)) return null;
    const octet = Number(p);
    if (octet > 255) return null;
    n = n * 256 + octet;
  }
  return n >>> 0;
}

/** True if `ip` falls inside the given IPv4 CIDR block (e.g. "192.0.2.0/24"). */
export function ipv4InCidr(ip: string, cidr: string): boolean {
  const [base, bitsStr] = cidr.split("/");
  const bits = Number(bitsStr);
  const ipInt = ipv4ToInt(ip);
  const baseInt = base === undefined ? null : ipv4ToInt(base);
  if (ipInt === null || baseInt === null || Number.isNaN(bits)) return false;
  if (bits <= 0) return true;
  const mask = (0xffffffff << (32 - bits)) >>> 0;
  return (ipInt & mask) === (baseInt & mask);
}

/**
 * Expand an IPv6 string to its 8 hextets (numbers), handling a single "::"
 * abbreviation and an optional zone id. Returns null if malformed.
 */
export function expandIpv6(ip: string): number[] | null {
  let addr = ip.trim().toLowerCase();
  const zone = addr.indexOf("%");
  if (zone >= 0) addr = addr.slice(0, zone);
  if (addr === "") return null;

  const parseGroups = (s: string): number[] | null => {
    if (s === "") return [];
    const groups = s.split(":");
    const out: number[] = [];
    for (const g of groups) {
      if (!/^[0-9a-f]{1,4}$/.test(g)) return null;
      out.push(parseInt(g, 16));
    }
    return out;
  };

  const halves = addr.split("::");
  if (halves.length > 2) return null;

  if (halves.length === 2) {
    const head = parseGroups(halves[0]!);
    const tail = parseGroups(halves[1]!);
    if (head === null || tail === null) return null;
    const missing = 8 - head.length - tail.length;
    if (missing < 0) return null;
    return [...head, ...new Array<number>(missing).fill(0), ...tail];
  }

  const groups = parseGroups(addr);
  if (groups === null || groups.length !== 8) return null;
  return groups;
}

/** True if `ip` falls inside the given IPv6 prefix (e.g. "2001:db8::/32"). */
export function ipv6InPrefix(ip: string, prefixCidr: string): boolean {
  const [base, bitsStr] = prefixCidr.split("/");
  const bits = Number(bitsStr);
  const a = expandIpv6(ip);
  const b = base === undefined ? null : expandIpv6(base);
  if (a === null || b === null || Number.isNaN(bits)) return false;
  let remaining = bits;
  for (let h = 0; h < 8; h++) {
    if (remaining <= 0) break;
    const take = Math.min(16, remaining);
    const mask = take === 16 ? 0xffff : (0xffff << (16 - take)) & 0xffff;
    if ((a[h]! & mask) !== (b[h]! & mask)) return false;
    remaining -= 16;
  }
  return true;
}

// Live, falsifiable proof of the central claim: this app makes zero network calls.
// We wrap fetch / XMLHttpRequest / sendBeacon to COUNT any attempt (they still call
// through). The app never calls them, so the count stays 0 — and in the shipped
// build, CSP `connect-src 'none'` would block any attempt regardless. Open the
// network tab and confirm it yourself.

let count = 0;
const listeners = new Set<() => void>();

function bump(): void {
  count += 1;
  for (const fn of listeners) fn();
}

const _fetch = window.fetch.bind(window);
(window as { fetch: typeof fetch }).fetch = (...args: Parameters<typeof fetch>) => {
  bump();
  return _fetch(...args);
};

const _open = XMLHttpRequest.prototype.open;
(XMLHttpRequest.prototype as { open: unknown }).open = function (
  this: XMLHttpRequest,
  ...args: unknown[]
) {
  bump();
  return (_open as (...a: unknown[]) => void).apply(this, args);
};

if (typeof navigator.sendBeacon === "function") {
  const _beacon = navigator.sendBeacon.bind(navigator);
  (navigator as { sendBeacon: unknown }).sendBeacon = (...args: Parameters<typeof navigator.sendBeacon>) => {
    bump();
    return _beacon(...args);
  };
}

export function getNetworkCount(): number {
  return count;
}

export function subscribeNetworkCount(fn: () => void): () => void {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

// Live network indicator for the central claim: this app makes zero network calls.
//
// We wrap the script-reachable request constructors — fetch, XMLHttpRequest,
// sendBeacon, WebSocket, EventSource — to COUNT any attempt (they still call
// through). The app never calls them, so the count stays 0. This is a live,
// falsifiable indicator, NOT the enforcement: the shipped build's CSP
// `connect-src 'none'` (plus `img-src 'self' data:`) is what actually blocks every
// vector, including image/navigation beacons this counter does not instrument.
// Open the network tab and confirm it yourself.

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

function countConstructor(name: "WebSocket" | "EventSource"): void {
  const ctor = (window as unknown as Record<string, unknown>)[name];
  if (typeof ctor !== "function") return;
  (window as unknown as Record<string, unknown>)[name] = new Proxy(ctor as new (...a: unknown[]) => object, {
    construct(target, args) {
      bump();
      return Reflect.construct(target, args);
    },
  });
}
countConstructor("WebSocket");
countConstructor("EventSource");

export function getNetworkCount(): number {
  return count;
}

export function subscribeNetworkCount(fn: () => void): () => void {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

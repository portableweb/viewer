/**
 * Bridge contract every adapter's document-start injection point must
 * expose before this shim runs. The shim is "standard interface,
 * viewer-controlled implementation": bundle code calls plain
 * `localStorage`, unmodified; the adapter owns where the bytes actually
 * live (Node fs today, mobile native store later).
 */
export interface StorageBridge {
  initialData: Record<string, string>;
  write(key: string, value: string | null): void;
  clear(): void;
}

/**
 * Canonical implementation. Deliberately self-contained — references
 * nothing outside its own body (only `window`/`Object`, both globals in
 * any realm) — so it can run two ways:
 *
 * 1. Called directly, when the adapter's injection point already shares
 *    the page's JS realm (Electron with contextIsolation off — see
 *    packages/electron/src/preload.ts). No eval needed, so it isn't
 *    blocked by a CSP that (correctly) omits 'unsafe-eval'.
 * 2. Shipped as a source string across a realm boundary via
 *    buildLocalStorageShimSource() below, for adapters that inject via a
 *    string API (iOS WKUserScript, Android addDocumentStartJavaScript).
 */
export function installLocalStorageShim(bridge: StorageBridge): void {
  let data: Record<string, string> = {};
  for (const k in bridge.initialData) {
    if (Object.prototype.hasOwnProperty.call(bridge.initialData, k)) {
      data[k] = bridge.initialData[k];
    }
  }

  function keys(): string[] {
    return Object.keys(data);
  }

  const storage = {
    getItem(key: string): string | null {
      key = String(key);
      return Object.prototype.hasOwnProperty.call(data, key) ? data[key] : null;
    },
    setItem(key: string, value: string): void {
      key = String(key);
      value = String(value);
      data[key] = value;
      bridge.write(key, value);
    },
    removeItem(key: string): void {
      key = String(key);
      if (Object.prototype.hasOwnProperty.call(data, key)) {
        delete data[key];
        bridge.write(key, null);
      }
    },
    clear(): void {
      data = {};
      bridge.clear();
    },
    key(index: number): string | null {
      const all = keys();
      return index >= 0 && index < all.length ? all[index] : null;
    },
  };
  Object.defineProperty(storage, "length", {
    get() {
      return keys().length;
    },
  });

  Object.defineProperty(window, "localStorage", {
    value: storage,
    configurable: false,
    writable: false,
  });
}

/**
 * Returns injectable JS source for adapters that must cross a realm
 * boundary as a string (not needed by Electron — see
 * installLocalStorageShim's doc comment). Derives the source from
 * installLocalStorageShim itself via toString(), so there is exactly one
 * implementation, never two to keep in sync.
 */
export function buildLocalStorageShimSource(): string {
  return `(function () {
  var bridge = window.__pwebStorageBridge;
  if (!bridge) {
    throw new Error("pweb localStorage shim: window.__pwebStorageBridge missing before injection");
  }
  (${installLocalStorageShim.toString()})(bridge);
})();`;
}

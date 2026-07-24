import { ipcRenderer } from "electron";
import { installLocalStorageShim } from "@portableweb/shims";

/**
 * Runs before the bundle's own scripts (Electron preload timing =
 * document-start). contextIsolation is off for bundle windows specifically
 * so this can rewrite the *real* page's `window.localStorage`, not an
 * isolated-world copy — see main.ts for why that's safe: the shim isn't
 * the security boundary (CSP + webRequest + session partitioning +
 * permission handlers are), so it's fine for this script to run in the
 * same world as untrusted content. nodeIntegration stays off throughout,
 * so the page itself never gets Node access regardless.
 */

// Core class fixed property (CONFORMANCE.md) — bundle content never
// registers service workers, not a deniable-but-requestable permission.
Object.defineProperty(navigator, "serviceWorker", {
  value: undefined,
  configurable: false,
});

// IndexedDB isn't shimmed yet (see packages/shims/README.md) — block it
// outright rather than leave an un-isolated native implementation reachable,
// which would silently violate the per-bundle isolation guarantee.
Object.defineProperty(window, "indexedDB", {
  value: undefined,
  configurable: false,
});

const storageEnabled = ipcRenderer.sendSync("pweb:storage-enabled") as boolean;

if (storageEnabled) {
  const initialData = ipcRenderer.sendSync("pweb:get-initial-storage") as Record<string, string>;
  // Called directly, not via eval'd string — contextIsolation is off for
  // this window, so this preload script already shares the page's real
  // JS realm, and calling straight into it also means the app's own CSP
  // (correctly) doesn't need 'unsafe-eval' just to support this.
  installLocalStorageShim({
    initialData,
    write: (key: string, value: string | null) => ipcRenderer.send("pweb:storage-write", key, value),
    clear: () => ipcRenderer.send("pweb:storage-clear"),
  });
} else {
  // D7: accessing localStorage when storage is denied throws, matching
  // ordinary web-platform denial semantics (e.g. a sandboxed iframe without
  // allow-same-origin) rather than a novel error type.
  Object.defineProperty(window, "localStorage", {
    get() {
      throw new DOMException("The operation is insecure.", "SecurityError");
    },
    configurable: false,
  });
}

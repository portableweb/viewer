import { app, BrowserWindow, session, dialog, ipcMain, Menu, Session, protocol } from "electron";
import * as fs from "node:fs";
import * as path from "node:path";
import { openBundle } from "@portableweb/core";
import { loadDocument, saveDocument, applyLocalStorageWrite, applyLocalStorageClear } from "@portableweb/store";
import { registerBundle, getBundle, unregisterBundle } from "./bundle-registry";
import { resolveBundleRequest } from "./bundle-request-resolver";
import { buildContentSecurityPolicy } from "./csp";

// If ELECTRON_RUN_AS_NODE is set, `require("electron")` resolves to a
// plain string (the binary path) instead of the Electron API object, and
// every import above is silently undefined — fails confusingly deep in
// app.getPath() otherwise. Caught this firsthand while smoke-testing.
if (typeof app === "undefined" || typeof app.getPath !== "function") {
  // eslint-disable-next-line no-console
  console.error(
    "Failed to load the Electron API. Run this via the Electron binary directly " +
      "(npm start / `electron .`), and make sure ELECTRON_RUN_AS_NODE is not set in your shell."
  );
  process.exit(1);
}

const PRELOAD_PATH = path.join(__dirname, "preload.js");
const STORE_BASE_DIR = path.join(app.getPath("userData"), "bundle-store");

let pendingOpenPath: string | null = null;

// C1 — must run before app is ready.
protocol.registerSchemesAsPrivileged([
  {
    scheme: "pweb",
    privileges: { standard: true, secure: true, supportFetchAPI: true, corsEnabled: false, stream: true },
  },
]);

function findBundlePathInArgv(argv: string[]): string | null {
  for (const arg of argv) {
    if (arg.toLowerCase().endsWith(".pweb") && fs.existsSync(arg)) return arg;
  }
  return null;
}

function showBundleErrorAndQuit(title: string, errors: string[]): void {
  dialog.showErrorBox(title, errors.join("\n") || "Unknown error");
  if (BrowserWindow.getAllWindows().length === 0) app.quit();
}

/**
 * C2–C10 — opens one bundle in its own isolated session + window.
 */
function openBundleWindow(filePath: string): void {
  let buffer: Uint8Array;
  try {
    buffer = new Uint8Array(fs.readFileSync(filePath));
  } catch (err) {
    showBundleErrorAndQuit("Couldn't read file", [(err as Error).message]);
    return;
  }

  const result = openBundle(buffer);
  if (!result.ok || !result.manifest || !result.entries) {
    showBundleErrorAndQuit(`Not a valid PortableWeb bundle (${result.code ?? "UNKNOWN"})`, result.errors);
    return;
  }
  const manifest = result.manifest;
  const entries = result.entries;

  // MANIFEST.md §5 — storage default is "isolated"; "none" disables it.
  // Every other permission (network, camera, microphone, geolocation,
  // clipboard_write, notifications, peers) has a false default and no
  // implementation yet, so it stays denied regardless of what the
  // manifest declares — declaration is never itself a grant.
  const storageEnabled = manifest.permissions?.storage !== "none";

  // C3 — per-bundle partition, so two bundles never share storage/cookies.
  const partitionSuffix = encodeURIComponent(manifest.id);
  const ses: Session = session.fromPartition(`persist:bundle-${partitionSuffix}`);

  // C2 — pull model: only ever answers from *this* open bundle's entries.
  ses.protocol.handle("pweb", async (request) => {
    const url = new URL(request.url);
    const requestPath = decodeURIComponent(url.pathname.replace(/^\//, ""));
    const resolved = resolveBundleRequest(buffer, entries, requestPath, manifest.entry);
    return new Response(Buffer.from(resolved.body), {
      status: resolved.status,
      headers: { "Content-Type": resolved.contentType },
    });
  });

  // C4 — deny every permission request unconditionally (no modules
  // implemented beyond storage, which isn't gated through this API).
  ses.setPermissionRequestHandler((_wc, _permission, callback) => callback(false));
  ses.setPermissionCheckHandler(() => false);

  // C5 — CSP on every response.
  ses.webRequest.onHeadersReceived((details, callback) => {
    callback({
      responseHeaders: {
        ...details.responseHeaders,
        "Content-Security-Policy": [buildContentSecurityPolicy()],
      },
    });
  });

  // C6 — belt-and-braces network block behind the CSP.
  ses.webRequest.onBeforeRequest((details, callback) => {
    callback({ cancel: !details.url.startsWith("pweb://") });
  });

  const storeDoc = loadDocument(STORE_BASE_DIR, manifest.id);

  const win = new BrowserWindow({
    width: manifest.viewport?.preferred_width ?? 1024,
    height: manifest.viewport?.preferred_height ?? 768,
    minWidth: manifest.viewport?.min_width,
    minHeight: manifest.viewport?.min_height,
    resizable: manifest.viewport?.resizable ?? true,
    title: manifest.title,
    webPreferences: {
      session: ses,
      preload: PRELOAD_PATH,
      // contextIsolation off is deliberate: the preload shim needs to
      // rewrite the *real* page's window.localStorage (document-start),
      // which an isolated world can't reach. nodeIntegration stays off,
      // so the page still has zero Node access regardless — the shim is
      // compatibility, not the security boundary (that's CSP + webRequest
      // + session partitioning + the permission handlers above).
      contextIsolation: false,
      nodeIntegration: false,
      sandbox: false,
      javascript: true,
      webSecurity: true,
    },
  });

  // Surfaces real failures (a broken shim, a bundle whose entry fails to
  // load) to the terminal instead of a silently blank window — not routine
  // console-message forwarding, which would spam stdout on every bundle
  // that logs anything.
  win.webContents.on("preload-error", (_event, preloadPath, error) => {
    console.error("[pweb] preload error in", preloadPath, error);
  });
  win.webContents.on("did-fail-load", (_event, code, description) => {
    console.error("[pweb] failed to load bundle content:", code, description);
  });

  // C7 — no popups, no external navigation.
  win.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
  win.webContents.on("will-navigate", (event, url) => {
    if (!url.startsWith("pweb://")) event.preventDefault();
  });

  registerBundle(win.webContents.id, {
    buffer,
    entries,
    manifest,
    storageEnabled,
    storeDoc,
    storeBaseDir: STORE_BASE_DIR,
  });
  win.webContents.once("destroyed", () => unregisterBundle(win.webContents.id));

  win.loadURL(`pweb://${partitionSuffix}/${manifest.entry}`);
}

function registerIpcHandlers(): void {
  ipcMain.on("pweb:storage-enabled", (event) => {
    event.returnValue = getBundle(event.sender.id)?.storageEnabled ?? false;
  });

  ipcMain.on("pweb:get-initial-storage", (event) => {
    event.returnValue = getBundle(event.sender.id)?.storeDoc.local_storage ?? {};
  });

  ipcMain.on("pweb:storage-write", (event, key: string, value: string | null) => {
    const ctx = getBundle(event.sender.id);
    if (!ctx || !ctx.storageEnabled) return;
    ctx.storeDoc = applyLocalStorageWrite(ctx.storeDoc, key, value);
    saveDocument(ctx.storeBaseDir, ctx.storeDoc);
  });

  ipcMain.on("pweb:storage-clear", (event) => {
    const ctx = getBundle(event.sender.id);
    if (!ctx || !ctx.storageEnabled) return;
    ctx.storeDoc = applyLocalStorageClear(ctx.storeDoc);
    saveDocument(ctx.storeBaseDir, ctx.storeDoc);
  });
}

// macOS: double-click / "Open With" before the app is ready.
app.on("open-file", (event, filePath) => {
  event.preventDefault();
  if (app.isReady()) {
    openBundleWindow(filePath);
  } else {
    pendingOpenPath = filePath;
  }
});

app.whenReady().then(() => {
  Menu.setApplicationMenu(null);
  registerIpcHandlers();

  const filePath = pendingOpenPath ?? findBundlePathInArgv(process.argv.slice(1));
  if (filePath) {
    openBundleWindow(filePath);
    return;
  }

  const picked = dialog.showOpenDialogSync({
    title: "Open a PortableWeb bundle",
    filters: [{ name: "PortableWeb Bundle", extensions: ["pweb"] }],
    properties: ["openFile"],
  });
  if (picked && picked[0]) {
    openBundleWindow(picked[0]);
  } else {
    app.quit();
  }
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

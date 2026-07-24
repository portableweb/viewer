# @portableweb/electron

**Status:** implemented and smoke-tested. Opens a real `.pweb` file
(verified against the canonical `spec/examples/hello.pweb`), renders it in
an isolated per-bundle session, and denies every capability except storage.

## What's implemented

- `registerSchemesAsPrivileged`: `pweb` as `standard:true, secure:true, supportFetchAPI:true`
- `session.protocol.handle('pweb')` — pull model, scoped per-bundle session, answers only from the open bundle via `@portableweb/core`'s resolver. `manifest.json`/`mimetype`/`META-INF/`/`.well-known/` are never served to content (AC6).
- Per-bundle `session.fromPartition('persist:bundle-<id>')` — two bundles never share storage/cookies.
- `setPermissionRequestHandler`/`setPermissionCheckHandler` — deny all (camera, mic, geolocation, notifications, clipboard, etc.). Fullscreen is allowed (MANIFEST.md default `true`, zero implementation risk) and isn't gated through this API.
- CSP injected on every response (see `src/csp.ts` for the exact policy and why `'unsafe-inline'` is required — the org's own `hello.pweb` example uses inline `<style>`/`<script>`) + `webRequest.onBeforeRequest` network block behind it.
- Popup/external-navigation block, service-worker registration deny (`navigator.serviceWorker = undefined`, Core class fixed property).
- **`M-STORAGE`-equivalent**: `localStorage` shimmed via `@portableweb/shims`, hydrated/write-behind-persisted through `@portableweb/store`'s per-bundle `.pwebdata`-style JSON file. Honors `manifest.permissions.storage` (`"isolated"` default = enabled, `"none"` = denied with a `SecurityError` on access, matching ordinary web-platform denial semantics). `indexedDB` is explicitly undefined — not shimmed yet, so left unreachable rather than exposed unisolated.
- `.pweb` file association (macOS `open-file` event + argv parsing for Windows/Linux), fallback native "Open" dialog when launched with no file.

## Deliberately not implemented

- `M-NET-READ`, camera/mic/geolocation, clipboard, notifications, IndexedDB shimming — no code paths exist for these; declaring them in a manifest has no effect.
- F01–F12 fixture *files* (only in-memory equivalents exist in `test/`), D1–D10 automated denial probes, AC1–AC8 formal acceptance checks — the checklist's §D–F is still open work.
- A dashboard/landing window, drag-and-drop — v1 is single-window: launch with a file, or get a native Open dialog.

## Development

```bash
npm run build   # from this directory, or via workspace root
npm start       # builds + launches `electron .`
npm test        # pure-logic unit tests (csp, mime, bundle-request-resolver)
```

**If `npm start` crashes with `Cannot read properties of undefined (reading 'getPath')`:** your shell has `ELECTRON_RUN_AS_NODE` set, which makes `require("electron")` resolve to a plain string instead of the API object. `main.ts` now detects this and exits with a clear message instead of that stack trace — unset the variable and retry.

## Packaging (`npm run dist`, electron-builder.yml)

Config is written and loads correctly (`appId`, `.pweb` file association,
per-platform icons — `build/icons/icon.icns`/`.png` generated from the
existing `web/docs/icons/icon-512.png`). **Not fully verified**: running a
real `electron-builder --dir` pack in this workspace triggered a known
electron-builder + npm-workspaces issue — its dependency-install/prune
step doesn't understand workspace hoisting and pruned devDependencies from
the *workspace root* `node_modules`, not just this package's (had to
`npm install` again at the root to recover). `npmRebuild: false` and
`buildDependenciesFromSource: false` are set as a mitigation, but a real
`npm run dist` hasn't been re-verified since — do that in an isolated
clone (or CI) before trusting it, not in a shared dev checkout.

Windows icon is a placeholder PNG, not a real multi-resolution `.ico` —
generate one (e.g. `npx electron-icon-builder --input=build/icons/icon.png --output=build/icons`)
before a real Windows build. Cross-compiling Windows/Linux installers from
this macOS machine hasn't been attempted — that's a CI job, same as the
old Tauri release workflow this replaced.

## Design notes worth knowing before changing this code

- **`contextIsolation: false` for bundle windows is deliberate**, not an oversight — the `localStorage` shim needs to rewrite the *real* page's `window.localStorage` (document-start timing, before the bundle's own scripts run), which an isolated world can't reach. `nodeIntegration` stays off throughout, so the page still has zero Node access. The shim is compatibility, not the security boundary — CSP + `webRequest` + session partitioning + the permission handlers are (see `portableweb-context.md` §4).
- **The shim is called directly, never via `eval`** (`src/preload.ts` calls `installLocalStorageShim()` from `@portableweb/shims`, not the string-returning `buildLocalStorageShimSource()`). Hit this the hard way: the app's own CSP has no `'unsafe-eval'`, so an eval-based injection was silently blocked by our own policy. Since `contextIsolation` is off, preload already shares the page's realm — no eval needed. The string-returning form still exists in `@portableweb/shims` for adapters that *do* need to cross a realm boundary (iOS `WKUserScript`, Android document-start injection).

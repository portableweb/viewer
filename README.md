# PortableWeb Viewer

One monorepo, all platforms. Shared core, thin per-platform adapters — see
`portableweb-context.md` §3–4 (in the workspace root, imported into
`CLAUDE.md`) for the full architecture writeup.

> **This repo was previously a standalone Tauri + React desktop app.**
> That's been replaced by the monorepo structure below — Electron is now
> the reference implementation, not Tauri. Prior Tauri source is still in
> git history if it's ever needed for reference.

## Layout

```
packages/
  core/           pure TS: ZIP container parsing, manifest validation,
                  path resolution — no platform APIs. IMPLEMENTED, tested.
  adapter-api/    adapter contract types. Not yet implemented.
  shims/          localStorage shim (document-start, write-behind).
                  IMPLEMENTED, tested. IndexedDB deliberately deferred.
  store/          store schema + Node fs persistence transport.
                  IMPLEMENTED, tested.
  electron/       desktop, reference implementation. IMPLEMENTED, smoke-
                  tested end-to-end (opens hello.pweb, storage round-trips).
  mobile/ios/     Capacitor project scaffolded + real Xcode project. Native
                  WKWebView/scheme-handler glue not written (unverifiable —
                  no Xcode here); one verified Swift file (DEFLATE bridge).
  mobile/android/ Capacitor project scaffolded + real Gradle build.
                  Container/manifest/resolve logic ported to Java and
                  covered by 22 passing JVM unit tests. WebView glue
                  (scheme handler, storage bridge) not yet written.
  web/            browser adapter. Parked.
fixtures/         F01–F12 conformance corpus (not yet populated as real
                  .pweb files; packages/core/test builds equivalents in
                  memory for unit testing).
tests/core/       Node + JSC engine drift detector. Not yet populated.
tests/denial/     D1–D10 probe harness, runs inside each adapter's webview.
                  Not yet populated.
```

## Current status

**v0.1 vertical slice target:** a Core-class-conformant viewer, Electron
only, zero Capability Modules (`V0.1-SLICE-CHECKLIST_1.md`). Storage
(`M-STORAGE`, originally slated for v0.2) was pulled forward and is also
implemented — see each package's own README for exactly what that does
and doesn't cover.

- ✅ `packages/core` — 29 passing tests: fast-ID, ZIP parsing, manifest
  validation, path resolution, `openBundle()`.
- ✅ `packages/store` — 12 passing tests: schema, serializer, atomic
  Node fs persistence.
- ✅ `packages/shims` — 9 passing tests: `localStorage` shim.
- ✅ `packages/electron` — 11 passing unit tests (CSP/mime/resolver) +
  verified end-to-end: launches, opens the real `spec/examples/hello.pweb`,
  denies every capability except storage, storage write round-trips to
  disk. `electron-builder.yml` packaging config written (see its README
  for a real npm-workspaces + electron-builder gotcha hit while writing it).
- 🟡 `packages/mobile/android` — real Capacitor project + real debug APK
  build + 22 passing JUnit tests for the ported container/manifest/resolve
  logic. WebView-level glue (scheme handler, storage bridge, document-start
  injection) not yet written.
- 🟡 `packages/mobile/ios` — real Capacitor/Xcode project scaffolded + one
  verified Swift file (the DEFLATE↔JSC bridge). WKWebView-level glue not
  written — no Xcode in this environment to verify it, so a precise plan
  is documented instead of unverified code.
- ⬜ `packages/web` — parked.
- ⬜ Fixture corpus (real `.pweb` files), D-probes, formal AC1–AC8
  acceptance checks — still open, checklist §D–F.

**61 automated tests total across core/store/shims/electron, all passing,
plus 22 more in the Android JVM unit tests** — run `npm test
--workspaces --if-present` from this directory for the TS side, `cd
packages/mobile/android/android && ./gradlew testDebugUnitTest` for
Android.

## Development

```bash
npm install
npm run build --workspaces --if-present
npm test --workspaces --if-present
```

Each package builds/tests independently; `packages/core` has zero runtime
dependencies (DEFLATE decompression is the one Node-specific seam —
`setInflateImplementation()` — isolated in `container.ts` for non-Node
engines, e.g. iOS's JavaScriptCore, to swap out).

**Running the desktop viewer directly:**

```bash
cd packages/electron
npm start                      # builds, then `electron .` — opens a native file picker
npm start -- /path/to/x.pweb   # or open a specific bundle
```

If that crashes with `Cannot read properties of undefined (reading
'getPath')`, your shell has `ELECTRON_RUN_AS_NODE` set — unset it and
retry (see `packages/electron/README.md`).

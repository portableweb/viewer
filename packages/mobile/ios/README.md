# @portableweb/mobile-ios

**Status:** real Capacitor project scaffolded (`npx cap add ios` ran
successfully — it doesn't require Xcode itself, just the native project
generator). `.pweb` file-type association added to `Info.plist`. One real,
verified Swift file (`PwebInflate.swift`, the DEFLATE bridge — see below).
**The WKWebView/scheme-handler/storage-bridge glue was deliberately not
written** — see "What's not real yet" below for why and the exact plan.

## What's real

- `ios/App/App.xcodeproj` — a genuine Xcode project, SPM-based (Capacitor 8
  uses Swift Package Manager for its own dependencies, not CocoaPods —
  good news, one less native toolchain requirement than expected).
- `ios/App/App/Info.plist` — `UTImportedTypeDeclarations` +
  `CFBundleDocumentTypes` for `org.portableweb.pweb` /
  `application/vnd.portableweb+zip` / `.pweb`, `LSHandlerRank: Owner`. This
  is what makes "Open With → PortableWeb" show up in Files/Mail/AirDrop.
- `capacitor.config.ts` — app id `org.portableweb.viewer`.

## What's not real yet: Swift glue

Not written this session — every Swift file in a v0.1 iOS viewer
(replacing Capacitor's default `www`-loading webview with one that opens
arbitrary `.pweb` files) would be **uncompiled and unverifiable** in this
environment: no full Xcode is installed, only Command Line Tools, so there
is no way to catch even a typo before calling it "done." Writing it blind
risks looking finished while silently being broken. Instead, here is the
concrete plan, precise enough to implement in one pass once Xcode is
available:

### Architecture: reuse `@portableweb/core` via JavaScriptCore, don't reimplement it in Swift

The whole point of the monorepo's "one JS core, thin adapters" design
(`portableweb-context.md` §3) is that container/manifest/resolution logic
lives in exactly one place. Porting ZIP parsing to Swift would duplicate
~400 lines of already-tested logic and create exactly the drift risk the
architecture is built to avoid. iOS ships JavaScriptCore natively — use it:

1. **Bundle `@portableweb/core` for JSC.** It's CommonJS (`require()`
   between its own files) — JSC's `JSContext` has no module loader, so
   `dist/src/*.js` needs a build step to concatenate/bundle into one
   IIFE (esbuild with no external deps would do this in a few lines of
   config). Not set up yet.
2. **The one native bridge needed: DEFLATE decompression.** JSC has no
   `zlib`. `packages/core/src/container.ts` already has the exact seam
   for this — `setInflateImplementation(fn)` (added this session, tested
   in `packages/core/test/container.test.ts`). **`ios/App/App/PwebInflate.swift`
   is a real, verified implementation** of the native half — a standalone
   Swift script (Command Line Tools include the Swift compiler, just not
   the iOS SDK/simulator) confirmed `compression_decode_buffer` with the
   `COMPRESSION_ZLIB` algorithm round-trips a known DEFLATE byte sequence
   correctly, byte-for-byte matching Node's `zlib`. Despite the enum case
   name, that algorithm decodes raw DEFLATE (RFC 1951), not zlib-wrapped
   (RFC 1950) — exactly ZIP's compression method 8, no header to strip.
   **Not yet done:** `PwebInflate.swift` exists on disk but isn't in
   `App.xcodeproj`'s file list yet — hand-editing `project.pbxproj`
   blind risks corrupting it, so add it via Xcode's "Add Files to App"
   the first time this project is opened there. Also not done: exposing
   it to a `JSContext` via `JSExport`/`JSValue`, which needs step 1
   (bundling core for JSC) to exist first.
3. **`WKURLSchemeHandler` for `pweb://`**, calling `openBundle()` (running
   inside the `JSContext`) once per opened file, then serving each
   `WKURLSchemeTask` from the returned entries — same shape as
   `packages/electron/src/main.ts`'s `ses.protocol.handle('pweb', ...)`
   and `bundle-request-resolver.ts`, just translated to Swift/JSC calls
   instead of direct TS calls.
4. **`WKUserScript` at `.atDocumentStart`, `forMainFrameOnly: true`**
   running `@portableweb/shims`'s `buildLocalStorageShimSource()` —
   that function exists specifically for this cross-realm-boundary case
   (unlike Electron, which calls `installLocalStorageShim()` directly —
   see `packages/electron/README.md`'s design notes for why those two
   entry points aren't interchangeable).
5. **`WKScriptMessageHandler`** for the storage bridge's `write`/`clear`
   calls, backed by `@portableweb/store`'s schema (the Node fs transport
   in `@portableweb/store` doesn't apply here — iOS needs its own
   transport, e.g. a small Swift file-write-behind, but the *schema and
   serializer* are meant to be shared, per `portableweb-context.md` §5).
6. **Hydration is the one real timing wrinkle**: Electron's preload can
   fetch initial storage data *synchronously* via `ipcRenderer.sendSync`
   before the shim installs. `WKScriptMessageHandler` has no synchronous
   round-trip. The shim would need a small adjustment for this platform —
   inject with an empty/pending store and have the bridge's `write` calls
   queue until a native `postMessage` delivers the real initial data, or
   preload the data into the `WKUserScript` source string itself (built
   per-load, not statically) rather than fetched via a bridge call. Not
   decided — flag this before implementing, since it changes
   `@portableweb/shims`'s API shape slightly for this adapter.

### What's left, and what can be built here without Xcode

Step 2 is done and verified. Step 1 (bundling `@portableweb/core` for JSC
via esbuild) is also independently doable and testable without a full iOS
build — it's just a Node-side build script, verifiable by running the
bundled output in plain `node` before ever touching Xcode. Steps 3–5
(`WKURLSchemeHandler`, `WKUserScript` injection, `WKScriptMessageHandler`)
are real iOS-framework code and do need Xcode/the iOS SDK to compile-check
— that's the actual blocker for this environment, not steps 1–2.

# @portableweb/mobile-android

**Status:** further along than iOS — real Gradle build toolchain and Android
SDK were actually available in this environment (unlike Xcode for iOS), so
this got genuine, verified progress rather than just a scaffold + a plan.

## What's real and verified

- `android/app/build/outputs/apk/debug/app-debug.apk` — **a real debug APK
  actually built** via `./gradlew assembleDebug` (`BUILD SUCCESSFUL`, 93
  tasks). Not run on a device/emulator (none available here), but a
  genuine compiled artifact, not a guess.
- **`PwebContainer.java`, `PwebManifest.java`, `PwebResolve.java`** — Java
  ports of `packages/core/src/container.ts`'s mimetype-validation logic,
  `manifest.ts`'s required-field validation (checked against the real
  `spec/spec/MANIFEST.md`, same as the TS version), and `resolve.ts`'s
  root-locked path normalization.
- **22 JUnit tests, all passing**, run via `./gradlew testDebugUnitTest`
  (real JVM execution, not Android-instrumented — no emulator needed for
  these): `PwebContainerTest` (9), `PwebManifestTest` (7),
  `PwebResolveTest` (6). Test result XML confirms `failures="0" errors="0"`
  across all three suites.
- `AndroidManifest.xml` — `android.intent.action.VIEW` intent filters for
  `application/vnd.portableweb+zip` and `*.pweb` over `content://`/`file://`,
  so "Open with → PortableWeb" works from Files/email/share sheets.

### Why Java ports instead of reusing `@portableweb/core` directly (unlike the iOS plan)

`java.util.zip.ZipFile`/`ZipEntry` already implement full, mature central-
directory parsing *and* DEFLATE decompression — the JDK solves exactly the
problem `@portableweb/core`'s from-scratch ZIP parser exists to solve on
platforms with no such library (like JavaScriptCore on iOS, which has
neither a ZIP reader nor zlib). Reimplementing that in Java would duplicate
an already-mature standard-library implementation for no benefit, so
`PwebContainer` only ports the two PortableWeb-*specific* rules no library
provides: the mimetype-is-first-entry check (needs raw byte access,
matching `container.ts`'s `fastIdentify`/`validateMimetypeEntry`) and
manifest/path validation. This is a different, more favorable situation
than iOS's — not an inconsistency, a reflection of what each platform's
standard library already covers.

## What's not done yet (same shape as iOS, not yet started here)

- `WebViewAssetLoader`-based `PathHandler` serving `pweb://`-equivalent
  resources — needs a secure virtual origin
  (`https://appassets.androidplatform.net/...`), per
  `portableweb-context.md` §4's Android row.
- Document-start `localStorage` shim injection — `WebViewCompat
  .addDocumentStartJavaScript` (AndroidX `webkit`, if the installed
  WebView supports the feature — check via `WebViewFeature.isFeatureSupported`)
  running `@portableweb/shims`'s `buildLocalStorageShimSource()` (the
  string form, same reasoning as iOS: this is a real realm boundary,
  unlike Electron).
- `@JavascriptInterface`-annotated storage bridge (`write`/`clear`) wired
  to a `@portableweb/store`-schema-compatible Android-side transport (not
  the Node fs one — needs its own, e.g. Android's private app storage
  directory + the same atomic-replace pattern).
- `MainActivity.java` still extends Capacitor's default `BridgeActivity`,
  loading `www/` — not yet switched to open arbitrary `.pweb` files from
  the `VIEW` intent's data URI.
- Actual on-device/emulator verification — no emulator was launched in
  this session (only the JVM unit tests and a static build were run).

## Development

```bash
cd android
./gradlew assembleDebug       # produces app/build/outputs/apk/debug/app-debug.apk
./gradlew testDebugUnitTest   # runs PwebContainerTest/PwebManifestTest/PwebResolveTest
```

Requires `ANDROID_HOME`/`local.properties` pointing at a real Android SDK
(this machine has one at `~/Library/Android/sdk` with platforms through 33
and build-tools through 35.0.0 — `local.properties` was auto-generated
pointing at it during `cap add android`).

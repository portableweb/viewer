# PortableWeb Viewer

Native desktop viewer for `.pweb` bundles. Built with [Tauri](https://tauri.app).

Opens `.pweb` files via double-click, drag-and-drop, or the `pweb open` CLI command. Also provides a home screen for packing, unpacking, validating, and scaffolding bundles.

---

## Quickstart

```bash
# 1. Install Rust (if not already installed)
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh

# 2. Install npm dependencies
npm install

# 3. Generate all icon sizes from the SVG
npx tauri icon src-tauri/icons/icon.svg

# 4. Run in dev mode
npm run tauri dev

# 5. Build for distribution
npm run tauri build
```

---

## Prerequisites

### All platforms
- [Node.js](https://nodejs.org) 20+
- [Rust](https://rustup.rs) (stable)

```bash
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
```

### macOS
Xcode Command Line Tools:
```bash
xcode-select --install
```

### Windows
- [Microsoft C++ Build Tools](https://visualstudio.microsoft.com/visual-cpp-build-tools/)
- WebView2 (included with Windows 11; [download for Windows 10](https://developer.microsoft.com/en-us/microsoft-edge/webview2/))

### Linux (Ubuntu/Debian)
```bash
sudo apt-get update
sudo apt-get install -y \
  libwebkit2gtk-4.1-dev \
  libssl-dev \
  libgtk-3-dev \
  libayatana-appindicator3-dev \
  librsvg2-dev
```

---

## Local Development

```bash
npm install
npx tauri icon src-tauri/icons/icon.svg   # generate icon sizes from SVG
npm run tauri dev
```

---

## Building for Distribution

```bash
npm run tauri build
```

Output is written to `src-tauri/target/release/bundle/`:

| Platform | Artifacts |
|---|---|
| macOS | `.dmg`, `.app` |
| Windows | `.msi`, `.exe` (NSIS) |
| Linux | `.AppImage`, `.deb` |

### macOS Universal Binary (Intel + Apple Silicon)

```bash
rustup target add x86_64-apple-darwin aarch64-apple-darwin
npm run tauri build -- --target universal-apple-darwin
```

---

## Code Signing

### macOS

Without signing, macOS Gatekeeper will warn users on first launch. To sign and notarize:

1. Enroll in the [Apple Developer Program](https://developer.apple.com/programs/) ($99/year).
2. Export your Developer ID certificate as a `.p12` file from Keychain Access.
3. Set the following environment variables before building:

```bash
export APPLE_CERTIFICATE="$(base64 -i path/to/certificate.p12)"
export APPLE_CERTIFICATE_PASSWORD="your-p12-password"
export APPLE_SIGNING_IDENTITY="Developer ID Application: Your Name (TEAMID)"
export APPLE_ID="your@apple.id"
export APPLE_PASSWORD="app-specific-password"   # generated at appleid.apple.com
export APPLE_TEAM_ID="YOURTEAMID"

npm run tauri build
```

For CI, store these as GitHub Actions secrets — the release workflow reads them automatically if present.

### Windows

Unsigned Windows builds work but show a SmartScreen warning. To sign:

1. Obtain a code signing certificate from a trusted CA (e.g. DigiCert, Sectigo).
2. Set before building:

```bash
export TAURI_SIGNING_PRIVATE_KEY="path/to/key.pem"
export TAURI_SIGNING_PRIVATE_KEY_PASSWORD="your-key-password"
```

### Linux

Linux builds do not require signing.

---

## Building for iOS

Requires macOS with Xcode installed.

```bash
# Add iOS Rust targets (one-time)
rustup target add aarch64-apple-ios x86_64-apple-ios aarch64-apple-ios-sim

# Initialize the Xcode project (one-time, commit the generated gen/apple/ directory)
npm run tauri ios init

# Run on simulator
npm run tauri ios dev

# Build IPA for distribution
npm run tauri ios build -- --export-method app-store-connect
```

Output: `src-tauri/gen/apple/build/arm64/PortableWeb.ipa`

### iOS Signing

Requires an [Apple Developer Program](https://developer.apple.com/programs/) membership ($99/year).

1. Create a Distribution certificate in Xcode → Settings → Accounts.
2. Create an App ID and Provisioning Profile in the Apple Developer portal.
3. For CI, store the following as GitHub Actions secrets:

| Secret | Description |
|---|---|
| `IOS_CERTIFICATE` | Base64-encoded `.p12` distribution certificate |
| `IOS_CERTIFICATE_PASSWORD` | Password for the `.p12` file |
| `IOS_PROVISIONING_PROFILE` | Base64-encoded `.mobileprovision` file |
| `KEYCHAIN_PASSWORD` | Any password — used to create a temp keychain in CI |
| `APPLE_TEAM_ID` | Your 10-character Apple Team ID |

---

## Building for Android

Requires Android Studio, JDK 17, and Android NDK.

```bash
# Install Android NDK via Android Studio SDK Manager or sdkmanager:
sdkmanager "ndk;27.0.12077973"
export NDK_HOME=$ANDROID_SDK_ROOT/ndk/27.0.12077973

# Add Android Rust targets (one-time)
rustup target add \
  aarch64-linux-android \
  armv7-linux-androideabi \
  i686-linux-android \
  x86_64-linux-android

# Initialize the Android project (one-time, commit the generated gen/android/ directory)
npm run tauri android init

# Run on emulator or connected device
npm run tauri android dev

# Build APK + AAB for distribution
npm run tauri android build
```

Output: `src-tauri/gen/android/app/build/outputs/`

### Android Signing

1. Generate a keystore (one-time):

```bash
keytool -genkey -v \
  -keystore portableweb.jks \
  -alias portableweb \
  -keyalg RSA -keysize 2048 \
  -validity 10000
```

2. For CI, store the following as GitHub Actions secrets:

| Secret | Description |
|---|---|
| `ANDROID_KEYSTORE` | Base64-encoded `.jks` keystore file |
| `ANDROID_KEYSTORE_PASSWORD` | Keystore password |
| `ANDROID_KEY_ALIAS` | Key alias (e.g. `portableweb`) |
| `ANDROID_KEY_PASSWORD` | Key password |

---

## Releasing

Push a version tag to trigger the GitHub Actions release workflow, which builds for all five platforms in parallel (macOS, Windows, Linux, iOS, Android) and creates a draft GitHub Release:

```bash
git tag v0.1.0
git push origin v0.1.0
```

Review the draft release on GitHub, then publish when ready.

> **Note:** Before the first mobile release, run `npm run tauri ios init` and `npm run tauri android init` locally and commit the generated `src-tauri/gen/` directory. The CI workflow depends on these files being present.

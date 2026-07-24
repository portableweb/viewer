# tests/denial/

**Status:** not yet populated. Per `V0.1-SLICE-CHECKLIST_1.md` §D, this is
the D-probe harness: a single probe bundle whose script exercises every
capability surface (`getUserMedia`, geolocation, notifications, `fetch`,
service worker registration, `window.open`, `localStorage`/`indexedDB`,
clipboard, fullscreen — D1–D10) and reports outcomes to the test harness,
run inside each adapter's real webview.

This is Electron-adapter work (`packages/electron`), not `packages/core`
work — `packages/core` has no webview to run probes inside. Build this
alongside `packages/electron`'s permission-handler wiring (checklist §C4).

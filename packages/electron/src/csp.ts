/**
 * v0.1/v0.2 CSP: allow the bundle to run and fetch/render itself, block
 * everything reaching outside pweb:. `'unsafe-inline'` is required —
 * the org's own canonical hello.pweb example uses an inline <style> and
 * <script> block, and most AI-generated single-file bundles do too, so
 * blocking inline content would break the common case rather than the
 * adversarial one. `connect-src pweb:` (not 'none') because the
 * `network` permission (default false, per MANIFEST.md §5) is about
 * fetch/XHR to *non-bundle* URLs — reading the bundle's own packaged
 * resources via fetch() isn't "network access."
 */
export function buildContentSecurityPolicy(): string {
  return [
    "default-src pweb:",
    "script-src pweb: 'unsafe-inline' 'wasm-unsafe-eval'",
    "style-src pweb: 'unsafe-inline'",
    "img-src pweb: data: blob:",
    "font-src pweb: data:",
    "media-src pweb: blob:",
    "connect-src pweb:",
    "worker-src pweb: blob:",
    "object-src 'none'",
    "frame-src 'none'",
    "base-uri 'none'",
    "form-action 'none'",
  ].join("; ");
}

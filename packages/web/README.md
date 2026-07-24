# @portableweb/web-viewer

**Status:** parked. Not part of the current push (`portableweb-context.md` §10).

Not to be confused with `portableweb/web` (portableweb.org marketing site +
existing browser PWA viewer) — this package is the *future* web adapter
built against this monorepo's `@portableweb/core`, once picked back up.

Architecture if revived: sandboxed opaque-origin iframe + postMessage broker
to the viewer's trusted parent page. Service workers can't control
opaque-origin iframes, which is why this shape was chosen over an
SW-based approach. Layered isolation: browser's opaque-origin storage
denial (layer 1) → broker-side namespacing by `id`, identified via
`event.source`, never payload-claimed identity (layer 2) → per-bundle quota
enforcement at the broker. Durability is best-effort (browser eviction),
which is what makes `.pwebdata` export matter even more here. No File
System Access API in general, so `storage.model: "document"` write-back
degrades to viewer-store export on this adapter, unconditionally.

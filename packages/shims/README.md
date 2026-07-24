# @portableweb/shims

**Status:** localStorage shim implemented and tested (9 tests). IndexedDB is
explicitly deferred — see below — rather than half-built.

`buildLocalStorageShimSource()` returns injectable JS source implementing a
synchronous, `Storage`-compatible `localStorage`, hydrated and write-behind
-flushed through a `window.__pwebStorageBridge` the adapter must expose
before the script runs (document-start). This is the "standard interface,
viewer-controlled implementation" pattern from `portableweb-context.md` §4:
bundle code calls plain `localStorage`, unmodified.

Consumed by `packages/electron`'s preload script, which supplies the bridge
backed by `@portableweb/store`.

## Deliberately not built yet: IndexedDB

A real IndexedDB shim (full transaction/cursor/index semantics, à la
`fake-indexeddb`) is a much larger surface than localStorage and wasn't
attempted in this pass — building a partial one would violate more than it's
worth. Bundles that only use `localStorage` get real isolated storage today;
bundles using `indexedDB` will see the native (non-isolated, or simply
absent depending on adapter) behavior until this is built. Track before
calling `M-STORAGE` complete.

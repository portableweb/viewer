# tests/core/

**Status:** not yet populated. Per `portableweb-context.md` §3, this is the
**Node + JSC engine matrix** — an early drift detector confirming
`packages/core` behaves identically across JS engines (relevant because
iOS eventually needs `packages/core` to run without Node's `zlib`, per the
`inflateRaw` seam noted in `packages/core/src/container.ts`).

`packages/core/test/` already has full unit coverage of B1–B7 running under
Node. This directory is for running that same suite (or an engine-neutral
subset of it) under a second engine once one is wired up — not needed until
a non-Node adapter (iOS/Android/web) is actually being built.

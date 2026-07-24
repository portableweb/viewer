# @portableweb/adapter-api

**Status:** not yet implemented. Scaffolded as a workspace placeholder only.

Will define the contract every platform adapter (`packages/electron`,
`packages/mobile/*`, `packages/web`) implements against `@portableweb/core` —
give-me-the-file, store-this, ask-permission, serve-these-bytes — per
`portableweb-context.md` §3–4.

Not required for the v0.1 Core-class slice (see `V0.1-SLICE-CHECKLIST_1.md`),
which wires the Electron adapter directly to `@portableweb/core`. This
package becomes load-bearing once a second adapter (mobile/web) exists and
the contract needs to be shared rather than implicit.

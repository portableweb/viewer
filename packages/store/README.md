# @portableweb/store

**Status:** not yet implemented. Scaffolded as a workspace placeholder only.

Will hold the one store schema and `.pwebdata` serializer shared across all
native platforms (only the transport differs per adapter), and eventually
the `userdata/` write-back path for `storage.model: "document"` bundles —
cartridge/save-file model, per `portableweb-context.md` §5 and
`portableweb-storage-authoring-context.md` §6.

`userdata/`/`.pwebdata` format unification is an open thread (not yet
decided) — don't start this package until that's resolved.

Out of scope for the v0.1 Core-class slice.

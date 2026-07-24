# fixtures/

**Status:** not yet populated. This is the shared conformance corpus
(F01–F12) described in `V0.1-SLICE-CHECKLIST_1.md` §E — actual `.pweb`
files, not the equivalent in-memory buffers `packages/core/test` builds on
the fly for unit testing.

Extraction to a neutral `portableweb/conformance` repo is deferred until an
external implementer shows up (`portableweb-context.md` §3).

| ID | Name | Expected behavior |
|---|---|---|
| F01 | `hello.pweb` | opens, renders |
| F02 | `bad-mimetype-missing.pweb` | reject |
| F03 | `bad-mimetype-not-first.pweb` | reject |
| F04 | `bad-mimetype-compressed.pweb` | reject |
| F05 | `bad-manifest-missing.pweb` | reject |
| F06 | `bad-manifest-invalid.pweb` | reject |
| F07 | `bad-entry-missing.pweb` | reject or defined error page (open thread) |
| F08 | `evil-traversal.pweb` | opens; escaping requests rejected |
| F09 | `evil-zip-names.pweb` | entries unreachable; bundle opens |
| F10 | `unknown-keys.pweb` | opens normally; everything denied |
| F11 | `probe-denial.pweb` | opens; probes report §3 outcomes |
| F12 | `probe-declared.pweb` | **keystone** — declaration ≠ grant |

Build these once the Electron adapter (`packages/electron`) exists to open
and render them — `packages/core/test/fixtures.ts` already has a working
zero-dependency ZIP writer that can be reused to generate the real files.

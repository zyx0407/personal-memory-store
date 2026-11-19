# Personal memory store

Two tools for a plain-text personal memory store that follows the Personal Memory Store Specification 1.0.

## Tools

### `memory_init`

Creates the three-item skeleton at an absolute path:

```
MEMORY.md
memory/
CHANGELOG.md
```

It never overwrites existing files and does not create `mss.json`.

| Parameter | Required | Meaning |
| --- | --- | --- |
| `root` | yes | Absolute path of the store root |

### `memory_doctor`

Read-only check of a store, returning the specification report.

| Parameter | Required | Meaning |
| --- | --- | --- |
| `root` | yes | Absolute path of the store root |
| `format` | no | `json` (default) for the full report, `text` for a short summary |

The report covers all 15 rules (S1–S13, P1, X1), computes the measured level (L0–L3), counts errors only for rules applicable to the declared level, and reports `declared` vs `verified`.

## What it checks

- Store layout and encoding (UTF-8, no BOM, LF)
- Entry grammar, metadata keys and value domains, key uniqueness
- Core and topic size limits
- Local absolute paths and `..` escapes
- `src` coverage and existence
- Fenced code block closure
- Obvious credentials
- `mss.json` validity and declared level

## Limits

- This is a structural check, not a full conformance test suite: S9 and P1 are approximate regex scans.
- It does not write entries, archive old facts, or rebuild indexes. Those stay implementation-defined in the specification.
- It sees the files on disk only; it does not inspect any harness's injection behavior.

Full specification: `SPEC.md` / `SPEC.en.md` in the repository.

# Personal Memory Store Specification

A long-term memory format for **one person**: one owner, one store, one harness that can touch the disk — the "who I am, what I lived through, why I decided this" written as portable plain text. One `MEMORY.md` core injected every turn, details in `memory/` read on demand, an append-only `CHANGELOG.md`, and a rebuildable `_state/` layer.

Not for team collaboration, multi-tenancy or cloud memory platforms; scoping, concurrency and permissions for those are out of scope.

**Release 1.0.0** (2026-11-19).

## Documents

| File | What it is |
| --- | --- |
| [`SPEC.md`](SPEC.md) | The specification 1.0 (Chinese) |
| [`SPEC.en.md`](SPEC.en.md) | The specification 1.0 (English) |
| [`schema/mss.schema.json`](schema/mss.schema.json) | JSON Schema for `mss.json` |
| [`schema/report.schema.json`](schema/report.schema.json) | JSON Schema for the `doctor` report |
| [`skills/memory-store/SKILL.md`](skills/memory-store/SKILL.md) | Installable DSH skill (build / write / check / migrate) |
| [`docs/architecture-en.png`](docs/architecture-en.png) · [`docs/architecture-zh.png`](docs/architecture-zh.png) | Four-zone diagram (English / Chinese) |
| [`CHANGELOG.md`](CHANGELOG.md) | Version history |
| [`LICENSE`](LICENSE) | Text CC BY 4.0; code and skill MIT |

## How to read

- **Implementing a store**: read §3–§9 and §11; self-check against §9.1; declare your level in `mss.json` per §4.1.
- **Wiring it into a harness**: read §7 and Appendix B (non-normative).
- **Using it directly**: install `skills/memory-store/` and follow SKILL.md; run `python skills/memory-store/scripts/check.py <root>` for a structural check.

## Minimal start

```
<root>/
  MEMORY.md
  memory/
  CHANGELOG.md
  mss.json          # optional
```

`mss.json`:

```json
{ "mss": "1.0", "store": "L2", "limits": { "core": 10240, "topic": 12288 } }
```

An entry:

```
- 2026-11-19 The memory library will be open-sourced {key=opensource.decision, type=decision, src=memory/release.md:28}
```

## DSH plugin

[`dsh-plugin/dsh-personal-memory-store/`](dsh-plugin/dsh-personal-memory-store/) is a DSH Host bundle exposing two tools:

- `memory_init(root)` — create the store skeleton
- `memory_doctor(root, format)` — check against spec 1.0, return a JSON report or a text summary

Install from DSH **Plugins → Add plugin → local directory**, or `plugin_manager install_bundle` pointing at that folder. Installed and tested on the author's machine (2026-11-19); the npm name `dsh-personal-memory-store` is reserved, not published yet.

## Reference implementation

The author's own implementation (the `mss` CLI, health checks, indexer) is not shipped here; this repository releases the specification, schemas, skill and templates only. Appendix D records recommended write/export practices.

## Status

**1.0.0 stable**: the rule set is frozen, `1.x` is compatible, rule changes go to a new major version. Both Chinese and English specs are available.

## License

Text CC BY 4.0; code and skill MIT. See [`LICENSE`](LICENSE).

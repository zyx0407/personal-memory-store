# Personal Memory Store Specification v1.0

| Item | Value |
| --- | --- |
| Status | Stable (1.0.0) |
| Version | 1.0.0 |
| Date | 2026-11-19 |
| Author | Ajiu (zyx0407) |
| Document license | CC BY 4.0 |
| Reference implementation license | MIT |

**Abstract**

This specification defines the file format, entry syntax and read-only conformance check of a **personal** long-term memory store. It targets a single user (one person, one store, one writer); team collaboration, multi-tenancy and cloud memory platforms are out of scope. Conformance applies to the store only, in four levels `L0`–`L3`. There are two commands: `init` (create a store) and `doctor` (read-only check producing a JSON report). Writing, export and indexing are implementation-defined; recommended practices are in Appendix D.

## 1. Scope

1. Store layout and encoding;
2. Entry syntax: date, text, fact key, source, status, escaping;
3. Command contract: `init`, `doctor`;
4. Conformance declaration and determination of a store.

Not specified: memory content, models, UI, write flow, storage engines, implementation language. Text files are the single source of truth. This specification targets a personal (single-user) store; multi-user, team, cloud multi-tenant and permission models are out of scope.

## 2. Normative content

- Normative: this chapter and §3–§6, §8, §9, §11.
- §1, §7, §10 and all appendices are non-normative.
- Every rule in §9.1 is **MUST**; an implementation MUST NOT report a MUST-rule failure as `warn`. A rule is mandatory only at its declared level and below (§8.3.1).

## 3. Terms

| Term | Definition |
| --- | --- |
| store | A root directory; if at least one of the three items (`MEMORY.md`, `memory/`, `CHANGELOG.md`) exists it is a store |
| library file | `MEMORY.md`, every file in the topic area, `CHANGELOG.md`, and `mss.json` if present; file names and extensions are case-sensitive |
| core area | `MEMORY.md` |
| topic area | regular files under `memory/` whose extension is lowercase `.md` (including subdirectories); files and directories whose name starts with `.` are ignored at any depth; symlinks, reparse points and special files are ignored |
| timeline | `CHANGELOG.md` |
| derived layer | `_state/` (implementation-defined, not memory; only regular files by their own directory-entry type are read; symlinks and special files are ignored) |
| fenced code block | A block defined in §6.4; its lines are not entries, change records, or P1/S9 scan targets (S13 still needs the fence lines) |
| entry | A line in the core or topic area, outside fenced code blocks, starting with `- ` |
| change record | A line in the timeline, outside fenced code blocks, starting with `- ` |
| current entry | An entry without `superseded` (an invalid value counts as absent) and with `status` not equal to `archived` |
| measured bytes | Raw byte count of the file, minus a BOM only; no re-encoding |
| today | Local date of the machine running the command (implementation time zone) |
| harness | Host program that calls the model and provides context each turn |

## 4. Conformance declaration

### 4.1 `mss.json`

A store root MAY contain `mss.json` (UTF-8, no BOM, LF):

```json
{
  "mss": "1.0",
  "store": "L2",
  "limits": { "core": 10240, "topic": 12288 }
}
```

- `mss` is required, MUST be a string matching `^[0-9]+\.[0-9]+$`, otherwise S11 fails.
- `declared` is derived from `store` only: `L0`–`L3` is taken as-is; an absent `store` key yields `null` and does NOT fail S11; any other value (including `null` or a non-string) yields `null` and fails S11.
- `limits` MUST be an object; only `core` and `topic` keys are allowed, unknown keys fail S11. `limits.core` and `limits.topic` MUST be mathematical integers in 1–1,000,000 (JSON numbers; `10240.0` counts as an integer, `1e4` as 10000; fractions, strings, booleans and `null` are invalid); an absent key takes the §5.2 default and does not fail; an invalid value takes the §5.2 default and fails S11 (without affecting `declared`).
- Duplicate keys in `mss.json` are treated as invalid JSON (§8.1 ③). Unknown top-level keys are ignored; unknown keys inside `limits` fail S11.
- Machine-readable schemas: `schema/mss.schema.json` and `schema/report.schema.json` (shipped with the release; the prose wins on conflict).

### 4.2 Declarations in the report

The report carries `store.declared`, `store.verified` and `conformant`; `declared` is defined in §4.1, the rest in §9.2.

## 5. Storage model

### 5.1 Paths

| Path | Required | Meaning |
| --- | --- | --- |
| `MEMORY.md` | yes | core area |
| `memory/` | yes | topic area, may be empty |
| `CHANGELOG.md` | yes | timeline |
| `mss.json` | no | declaration |
| `_state/` | no | derived layer, deletable and rebuildable |

### 5.2 Effective limits

`coreLimit` = `limits.core` from `mss.json` (10240 when absent or invalid); `topicLimit` = `limits.topic` (12288 when absent or invalid). The two fields are evaluated independently; `coreLimit` and `topicLimit` in the report MUST be the effective values.

## 6. Entry syntax and encoding

### 6.1 Encoding

- Library files MUST be UTF-8, no BOM, LF line endings (judged by S8); any number of trailing LFs is allowed. A trailing `\r` is kept as line content and fails S8.

### 6.2 Line format

Entries and change records MUST be one of these four forms (`<date>` is `YYYY-MM-DD`; the whole token MUST match `^[0-9]{4}-[0-9]{2}-[0-9]{2}$`; shape only, no calendar validation):

```
- <date>
- <date> <text>
- <date> <text> {<metadata>}
- <date> {<metadata>}
```

- After the date only one of: end of line; one U+0020 plus non-empty text; one U+0020 plus a metadata group; one U+0020 plus non-empty text, one U+0020, then a metadata group.
- Text MUST NOT start or end with whitespace; exactly one U+0020 between text and the metadata group; after `}` only whitespace is allowed until end of line.
- The metadata group MUST contain at least one `key=value`; keys and values MUST NOT be empty; no whitespace directly inside `{` or `}`; pairs MUST use `, ` separators and `=` without surrounding spaces.
- Backslash is the only escape lead: `\\` is a literal backslash, `\{` and `\}` literal braces; any other `\x` is a literal backslash followed by `x`; a lone `\` at end of line is a literal backslash; unescaping is a single left-to-right pass.
- Unescaped `{` or `}` MUST NOT appear in text (judged lexically on the raw line).
- Metadata values MUST NOT contain `,`, `}` or `=`; the path a `src` points to MUST NOT contain these characters either.
- Only the keys listed in §6.3 are allowed, each at most once; otherwise the whole line violates §6.2.
- `status` defaults to `active`.
- A line containing CR violates this section (S4/S5 fail).
- Unescaping is used only to obtain values and for S9/P1 scans: entry and change-record lines are scanned unescaped; headings, tables, prose and `mss.json` are scanned raw.
- Recommended write format: Appendix D (non-normative).
- A "parsable line" is a line satisfying the four forms, spacing, escaping and key-set rules of this section (excluding §6.3 value domains).
- "Whitespace" in this section means U+0020 only, not Tab or CR.

### 6.3 Metadata

| Key | Value |
| --- | --- |
| `key` | `^[a-z0-9][a-z0-9._-]{0,63}$` |
| `type` | optional; `fact`／`preference`／`decision`／`event`, default `fact` |
| `src` | `^(?!.*\.\.)[\p{L}\p{N}._~-]+(/[\p{L}\p{N}._~-]+)*(:[0-9]+)?$`; MUST NOT match `^[A-Za-z]:`; no backslash or empty segment |
| `valid` | optional; `^[0-9]{4}-[0-9]{2}-[0-9]{2}$`, the date the fact became true; defaults to the entry date |
| `status` | `active`／`archived` |
| `superseded` | `^[0-9]{4}-[0-9]{2}-[0-9]{2}$` |

### 6.4 Fenced code blocks

- Opening: after at most 3 leading spaces, a maximal run of ≥3 backticks or ≥3 tildes; the run length is the fence length; an info string may follow the run.
- Closing: at the same indentation, a maximal run of the same character with length ≥ the opening length, followed only by U+0020, Tab or CR.
- The fence state machine does not nest: inside a block only a closing fence is recognized; other fence-like lines are content.
- Lines inside a block are not entries or change records, and are not scanned by P1 or S9.
- An unclosed fence: library file → S13 fails; a file under `_state/` → S1 fails.

## 7. Injection practice (non-normative)

Recommended: the harness reads the full `MEMORY.md` and puts it into context before the first model request of each turn; re-injects it after context compaction or truncation; shrinks the core instead of truncating the injection; does not auto-inject `memory/`. Examples in Appendix B.

## 8. Command contract

### 8.1 General

- Command names are fixed; all accept `[--root <dir>]`, defaulting to the current directory.
- `--help`/`--version` do not inspect a store and exit 0.
- Standard output carries results only; diagnostics go to stderr; output is UTF-8.
- Usage: apart from `--help`/`--version` (highest priority, exit 0), any call that cannot be parsed per §8.2 — unknown command, unknown option, option missing its value, repeated option, extra positional argument, `--root` missing its value — exits 2. Only `--root <dir>` as two tokens is accepted; `--root=<dir>` and similar exit 2.
- "Existence" of the three items is judged by exact directory-entry name, regardless of type; type errors are reported by S2/S3/S4. When none of the three exists, exit 3 first (except `init`), without reading `mss.json`; when `--root` does not exist, `init` creates it recursively and other commands exit 3; when `--root` exists but is not a directory or cannot be listed, exit 4 (before 3). `_state/` is ignored if absent or not a directory; if it exists but cannot be listed, exit 4.
- Unified decoding: all library files are decoded as UTF-8, invalid bytes replaced by U+FFFD; a leading BOM is removed before parsing; lines are split on `\n`; a trailing `\r` stays in the line (and fails S8).
- Type check precedes reading: `MEMORY.md`/`CHANGELOG.md` not being regular files fails S2/S4; `memory/` not being a directory fails S3; `mss.json` not being a regular file fails S11; type-mismatched items do not participate in content rules and do not trigger exit 4. For cross-file rules (S5/S8/S9/S13/P1): only the type-mismatched item is removed from that rule's targets and other files are judged normally; only when the rule has no target at all does it report `ok=true` with detail `not applicable`. `--root` is resolved to a real directory (following its own link); items inside the store are judged by their own directory-entry type, without following symlinks or reparse points.
- Exit 4 is used only for: an actual I/O read failure of a regular file, or an unlistable `memory/` or `_state/` directory; no report is emitted.
- `mss.json` is decoded strictly as UTF-8 (no U+FFFD replacement); invalid bytes or NUL make it invalid JSON (③); a leading BOM is removed before parsing.
- `mss.json` handling: ① unreadable (I/O) → exit 4; ② absent → `declared=null`, S11 not applicable; ③ invalid JSON (including decode failure or duplicate keys) → `declared=null`, S11 fails, continue; ④ readable valid JSON but `mss` missing or malformed → S11 fails, continue, `declared` per §4.1; ⑤ `mss` well-formed but version incompatible → exit 5 (no report); ⑥ other field-domain violations → invalid fields take §5.2 defaults, valid fields stay effective, `declared` per §4.1, S11 fails and continue.
- Ordering: complete type checks and all library-file reads (4) before judging the `mss.json` version (5); if both apply, return 4.
- Only `doctor` emits a report, and only for exit codes 0 and 1.
- `init` does not parse `mss.json` and never returns 5.

### 8.2 Commands

| Command | Usage | Behavior |
| --- | --- | --- |
| init | `mss init [--root <dir>]` | Creates missing `MEMORY.md` (content `# Memory` plus one LF), `memory/`, `CHANGELOG.md` (content `# Changelog` plus one LF); creates `--root` recursively if absent; never overwrites existing files; does not create `mss.json`; exit 4 if any target cannot be put in place (parent not writable, or target exists with the wrong type including symlinks); exit 0 on success |
| `doctor` | `mss doctor [--root <dir>]` | Read-only; checks in place and emits the report (8.3); never modifies the store |

### 8.3 Report

Standard output is a single JSON object followed by a newline, with no other text.

| Field | Type | Required | Value |
| --- | --- | --- | --- |
| `reportVersion` | string | yes | `"1"` |
| `spec` | string | yes | `mss/<spec version supported by this tool>` |
| `store` | object | yes | `{declared: "L0"–"L3"\|null, verified: "L0"–"L3"\|"none"}` |
| `conformant` | boolean | yes | see §9.2 |
| `errors` | integer | yes | see 8.3.1 |
| `warns` | integer | no | default 0; failures of implementation-defined advisory checks |
| `checks` | array | yes | each `{id, severity, ok, detail}`; `severity` ∈ `error`／`warn`／`info` |
| `metrics` | object | yes | see 8.3.2 |

**8.3.1 `checks` and `errors`**

- `checks` MUST cover every §9.1 rule, one item each (including `ok=true`), in the fixed order S1, S2, S3, S4, S5, S6, S7, S8, S9, S10, S11, S12, S13, P1, X1; implementation-defined `W*` checks come after X1.
- `severity` depends on applicability, not on `ok`: rules whose level is ≤ `declared` (`declared=null` counts as L0) or global rules are always `error`; rules above `declared` are always `info`.
- `errors` MUST equal the number of checks with `severity=error` and `ok=false`.
- `warns` counts only implementation-defined `W*` checks (`severity` must be `warn`).
- `detail` is a single-line string of at most 200 Unicode code points (truncate with `…` beyond that), naming the checked object; include values when quantifiable; format is an explanation without the rule id, e.g. `coreBytes=10240 coreLimit=9216`, `keys 12 unique`, `9 files utf-8 no bom lf`.

**8.3.2 `metrics`**

| Field | Type | Meaning |
| --- | --- | --- |
| `coreBytes` | integer | measured bytes of `MEMORY.md`; 0 if absent |
| `coreLimit` | integer | effective limit (§5.2) |
| `topicLimit` | integer | effective limit (§5.2) |
| `topicBytesMax` | integer | max measured bytes among topic files; 0 if none |
| `entries` | integer | number of `- ` lines in core and topics, outside fences (not filtered by validity) |
| `topics` | integer | number of topic files |
| `timelineEntries` | integer | number of change records |

### 8.4 Exit codes

| Code | Meaning |
| --- | --- |
| 0 | success, `errors = 0` |
| 1 | completed with `errors > 0` |
| 2 | usage error |
| 3 | none of the three items exists (except `init`) |
| 4 | I/O failure (including unreadable `mss.json`) |
| 5 | incompatible `mss.json` version (`doctor` only) |

Order: 2 → 3 → 4 → 5 → 1 → 0. Exit 0 from `init`, `--help` and `--version` does not participate in `errors`.

## 9. Conformance

> Regexes are given in **ECMAScript 2024 (`u` flag)** semantics: `\w` and `\b` are ASCII; `\s` includes Unicode whitespace. Implementations may translate them to another engine but MUST preserve semantics; engines without lookaround MUST implement equivalent logic (the spec gives no per-engine equivalences).

### 9.1 Rule table

| Rule | Strength | Requirement | Criterion |
| --- | --- | --- | --- |
| S1 | MUST | Text is the only source of truth | Every file under `_state/` decodable per §8.1 (including `manifest.json`; files with NUL are skipped entirely, fence check included), after removing fenced blocks, MUST NOT contain a "parsable line" (§6.2); an unclosed fence under `_state/` fails S1 |
| S2 | MUST | `MEMORY.md` exists and is a regular file | Exact directory-entry name (case-sensitive) and type regular file |
| S3 | MUST | `memory/` exists and is a directory | Exact directory-entry name (case-sensitive) and type directory |
| S4 | MUST | `CHANGELOG.md` exists and is a regular file; its change records satisfy §6.2 and §6.3; fences are closed | Exact name + type + line parsing + fence state |
| S5 | MUST | `- ` lines in core and topics, outside fences, satisfy every §6.2 clause and §6.3 | Per-line form, spacing, escaping, metadata keys and value domains |
| S6 | MUST | At most one current entry per `key` (store-wide) | Key aggregation over "parsable lines" in core and topics outside fences (excluding change records); lines with invalid `key` do not participate |
| S7 | MUST | `coreBytes ≤ coreLimit` | Byte comparison (`coreLimit` per §5.2) |
| S8 | MUST | Library files are UTF-8, no BOM, LF | Byte inspection; any number of trailing LFs allowed |
| S9 | MUST | No drive-letter paths, UNC paths, root paths or `..` escapes in library files | Traverse files in UTF-8 path byte order; replace fenced blocks with blank lines (keeping line numbers); unescape entry/change-record lines, keep other lines raw; fail on the first match, in order: ① `\bfile:(?=//)` (`i`) ② `(?<![A-Za-z0-9])[A-Za-z]:[\\/]` ③ `(^|[\s(（\[\]"'=,<*:：\x60])\\\\[A-Za-z0-9._-]` ④ `(^|[\s(（\[\]"'=,<*:：\x60])\\[A-Za-z0-9._-]` ⑤ `(?<![\w:])//[A-Za-z0-9._-]`; then delete `(?<![A-Za-z0-9])[A-Za-z][A-Za-z0-9+.-]{1,}://\S+` and match ⑥ `(^|[\s(（\[\]"'=,<*:：\x60])/(?=[^\s/])` ⑦ `(^|[/\\])\.\.(?=[/\\]|$)`; detail reports the first hit as `store-relative path:line <matched path token>`, with `(+N more)` for further hits |
| S10 | MUST | Every entry has `src`, pointing to an existing file inside the store | Only "parsable lines" in core and topics outside fences (excluding change records): lines with an invalid `src` count as uncovered; for valid `src`, strip a trailing `:<digits>`, resolve relative to the store root, match segment by segment exactly (case-sensitive, no separator normalization), and the target MUST be a regular file inside the store; all entries count (including `archived` and `superseded`); zero lines passes; otherwise coverage MUST be 100% |
| S11 | MUST | If `mss.json` exists: parseable, `mss` present and well-formed, `store` (if present) and `limits` value domains valid | Per-item schema validation; unparseable fails; absent is not applicable (`ok=true`); an absent `store` does not fail |
| S12 | MUST | `topicBytesMax ≤ topicLimit` | Byte comparison (`topicLimit` per §5.2) |
| S13 | MUST | Fenced code blocks in every library file are closed | State-machine scan of every library file |

Global rules (outside levels; failures count into `errors`):

| Rule | Strength | Requirement | Criterion |
| --- | --- | --- | --- |
| P1 | MUST | No credentials or sensitive fields in library files | Case-insensitive (`i`), fenced blocks replaced by blank lines (keeping line numbers), entry lines unescaped, then scan every library file: `(sk-[A-Za-z0-9]{10,}|gh[pousr]_[A-Za-z0-9]{20,}|AKIA[0-9A-Z]{16}|xox[baprs]-[A-Za-z0-9-]{10,}|(?<![0-9])1[3-9][0-9]{9}(?![0-9])|(身份证|id\s*card)[^\n]{0,20}[0-9]{17}[0-9Xx]|\b(password|token|secret|api[_-]?key)\s*=)`; detail reports the first hit as `store-relative path:line` (no content echo), with `(+N more)` |
| X1 | MUST | Declared level MUST NOT exceed the measured level | Fails when `declared != null` and (`verified="none"` or `declared > verified`); `detail` is `declared <declared> > verified <verified>` |

### 9.2 Levels

Each level requires all rules of that level and lower to pass:

| Level | Rules introduced at this level |
| --- | --- |
| L0 | S1, S2, S3, S4, S5, S8, S11, S13 |
| L1 | S6 |
| L2 | S7, S9, S12 |
| L3 | S10 |

- A rule's applicable level is its introducing level; global rules have no level.
- `store.verified` = the highest level passed; `none` is below L0.
- `conformant` = the declared level (L0 when `declared=null`) is reached and `errors == 0`; it is relative to the declared level and does not mean a higher level.

### 9.3 Determination

1. `doctor` checks every rule (including `ok=true`), computes `errors` per 8.3.1 and `verified`/`conformant` per 9.2.
2. When the declared level exceeds the measured level, `checks` MUST contain `{id:"X1", severity:"error", ok:false}` and count it into `errors`.
3. Global-rule failures count into `errors` and do not change the level.

## 10. Security and privacy (non-normative)

- See P1 in §9.1.
- Memory content MUST NOT be transmitted without the user's explicit authorization.

## 11. Versioning and compatibility

- Version format `major.minor`.
- **Stable 1.0**: any `mss` with major `1` is compatible (`1.x`); a different major makes `doctor` exit 5. The rules are frozen at 1.0.0; errata do not change rule semantics, rule changes go to a new major.
- From 1.0 on, the major version is sufficient; a major change means incompatible changes, and new or tightened rules MUST go to a new major.

## Appendix A Reference values (non-normative)

Diagram: `docs/architecture-en.png` (English), `docs/architecture-zh.png` (Chinese), non-normative.

| Item | Author's values |
| --- | --- |
| `limits.core` | 10240 bytes |
| `limits.topic` | 12288 bytes |
| Core overflow strategy | shrink first, never truncate the injection |
| Read order | inject core → read topics on demand |
| Miss | return empty, never guess |
| Write concurrency | one writer process at a time (non-normative) |

## Appendix B Injection examples (non-normative)

| Environment | Practice |
| --- | --- |
| DeepSeek Harness | read the full `MEMORY.md` into context each turn |
| Claude Code | read the full `MEMORY.md` into context each turn |
| Codex | read the full `MEMORY.md` into context each turn |

## Appendix C Examples (non-normative)

**Valid entries**

```
- 2026-11-15 The memory library will be open-sourced {key=opensource.decision, src=memory/release.md:28}
- 2026-11-14 Earlier plan waited for the certificate {key=opensource.decision, src=memory/release.md:24, status=archived, superseded=2026-11-15}
```

**Invalid entries**

```
- The memory library will be open-sourced          ← missing date
- [2026-11-15] The memory library will be open-sourced ← wrong date shape
- 2026-11-15 The memory library will be open-sourced {key=Open Source} ← key has spaces and uppercase
```

**doctor report (declared L2, measured L1; S9 fails)** — `checks` covers all 15 rules:

```json
{
  "reportVersion": "1",
  "spec": "mss/1.0",
  "store": { "declared": "L2", "verified": "L1" },
  "conformant": false,
  "errors": 2,
  "warns": 0,
  "checks": [
    { "id": "S1", "severity": "error", "ok": true, "detail": "_state holds no entries" },
    { "id": "S2", "severity": "error", "ok": true, "detail": "MEMORY.md exists" },
    { "id": "S3", "severity": "error", "ok": true, "detail": "memory/ exists" },
    { "id": "S4", "severity": "error", "ok": true, "detail": "CHANGELOG.md, 118 change records, fences closed" },
    { "id": "S5", "severity": "error", "ok": true, "detail": "40 entries parsed" },
    { "id": "S6", "severity": "error", "ok": true, "detail": "keys 12 unique" },
    { "id": "S7", "severity": "error", "ok": true, "detail": "coreBytes=9216 coreLimit=10240" },
    { "id": "S8", "severity": "error", "ok": true, "detail": "9 files utf-8 no bom lf" },
    { "id": "S9", "severity": "error", "ok": false, "detail": "MEMORY.md:14 F:/" },
    { "id": "S10", "severity": "info", "ok": true, "detail": "src coverage 40/40" },
    { "id": "S11", "severity": "error", "ok": true, "detail": "mss.json valid" },
    { "id": "S12", "severity": "error", "ok": true, "detail": "topicBytesMax=12000 topicLimit=12288" },
    { "id": "S13", "severity": "error", "ok": true, "detail": "all fences closed, 9 files" },
    { "id": "P1", "severity": "error", "ok": true, "detail": "no secrets" },
    { "id": "X1", "severity": "error", "ok": false, "detail": "declared L2 > verified L1" }
  ],
  "metrics": {
    "coreBytes": 9216, "coreLimit": 10240,
    "topicLimit": 12288, "topicBytesMax": 12000,
    "entries": 40, "topics": 6, "timelineEntries": 118
  }
}
```

## Appendix D Write and export advice (non-normative)

The spec does not define write commands. The author's practice, for reference:

- `index --rebuild`: write `_state/manifest.json` with library-file paths and sha256.
- Recommended entry form: metadata separated by `, `, no spaces around `=`, key order `key, type, src, valid, status, superseded`.
- `write <file>`: append entries to `memory/<topic>.md`; mark the current entry of the same `key` as `status=archived, superseded=<today>`; fill `src` with the input file's store-relative path (or `memory/<topic>.md` when the input is outside the store); one timeline line per entry.
- `delete --key <k> --yes`: only set status to `archived` and add one change record; never delete the body.
- `export --out <dir>`: copy the library files preserving the store layout, excluding `_state/`.

## Appendix E Comparison with open-source memory systems (non-normative)

| System | Model | Mapping to this spec |
| --- | --- | --- |
| Mem0 | fact-level memories + metadata; `user_id`/`agent_id`/`run_id` scopes; ADD/UPDATE/DELETE | one entry = one fact; `type` separates facts from preferences; a scope is one store root, not an entry field; `superseded` preserves update/delete history |
| Letta / MemGPT | self-editable core memory blocks + recall/archival tiers | core area = core block; topic area = archival; `status`/`superseded` record self-edits |
| Zep / Graphiti | bi-temporal graph: `valid_at`/`invalid_at`/`created_at` + episodes | entry date = record time; `valid` = valid time; `superseded` ≈ `invalid_at`; `src` anchors an episode |
| Cognee | ECL pipelines, graph + vector, datasets | store root = dataset; graph/vector are derived layers; text remains the source of truth |
| MemOS | MemCube: plaintext/activation/parameter | plaintext = library files; activation and parameters = derived layer, rebuildable |

Adopted in 1.0: `type` (typed memory), `valid` (minimal bi-temporality), one root per scope, rebuildable derived layer. Not adopted: vector/graph as the sole source of truth, scope stuffed into entry text.

## Appendix F Change log

| Version | Date | Changes |
| --- | --- | --- |
| 0.1–0.11 | 2026-11-15 | See earlier drafts; eight external review rounds |
| 0.12 | 2026-11-15 | `declared` from `store` only; `doctor`/`verify` merged into `doctor`; S13 (fence closure); `info` severity and `errors` accounting; `file:`/drive letters checked before URL stripping; S9 detail and traversal order fixed; P1 no content echo; empty-text+metadata form; unescaping only on entry lines; `--version` token unified; sample recomputed |
| 0.13 | 2026-11-15 | Date-shape rule moved into §6.2; four line forms; `src` regex; strict S5 form checking; S9 removes fences first, both separators, protocol-relative refs and quote contexts; S2/S3/S4 exact names; absent `store` does not fail S11; `--help`/`--version` short-circuit; fixed check order and detail templates; sample values |
| 0.14 | 2026-11-15 | Unicode `src`; four forms + spacing/text/metadata details; S4 also checks §6.3; type checks for S2/S3/S4; S1 by line form; `entries` definition; `--root` unlistable and read failures exit 4; severity scope; S9 hit token; P1 detail aligned; concurrency moved to appendix |
| 0.15 | 2026-11-15 | Read failure vs type mismatch; non-nesting fence state machine; `_state` unclosed fence → S1; `key`/`src`/`superseded` anchored regexes and dialect; per-field `limits` fallback; S5/S6/S10 only parsable lines; S9 rewritten with drive/UNC/root/`..` and backtick contexts; P1 keeps line numbers; `detail` without rule id; `conformant` relative to declared |
| 0.16 | 2026-11-15 | `mss.json` decoding and BOM; `limits` types and unknown keys; `--root` type and ordering; type mismatch does not trigger 4; `init` target conflicts exit 4; S10 target must be a regular file; S6/S10 only parsable lines |
| 0.17 | 2026-11-15 | S6/S10 exclude change records; closing-fence trailing chars; S1 unified decoding and "parsable line"; version string pinned to 0.17; S9 UNC and backslash root paths; type check before reading; usage-error list and priority; JSON numbers/duplicate keys/invalid `superseded`; no symlink following; `init` creates parents |
| 0.18 | 2026-11-15 | Final gate: absent/invalid `mss` per §8.1 ③④, version pinned to 0.18; max-run fences; topics and `_state` regular files only; type-mismatch items `not applicable`; existence by name regardless of type; invalid `src` counts uncovered and exact segment matching; unknown top-level keys ignored, unknown `limits` keys fail; lone trailing backslash; CRLF and trailing-LF rules; `--root` two tokens only; `init` wrong-type targets exit 4 |
| 1.0.0 | 2026-11-19 | Stable: rules frozen on the v0.18 baseline; optional keys `type` (fact/preference/decision/event) and `valid` (valid time); JSON Schemas, skill package, CHANGELOG and dual license; Appendix E (Mem0／Letta／Zep／Cognee／MemOS comparison); version policy `1.x` |

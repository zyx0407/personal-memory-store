#!/usr/bin/env python3
"""MSS 1.0 结构自检（非规范 doctor）。

用法：
  python check.py <root>          # 人读摘要
  python check.py <root> --json   # JSON（结构自检，不是规范级 doctor）

覆盖 S1–S13、P1、X1 的静态可判部分；S9/P1 为近似检查。
正式判定以 SPEC.md 为准。
"""
import json
import re
import sys
from pathlib import Path

ALLOWED = {"key", "type", "src", "valid", "status", "superseded"}
DATE = re.compile(r"^\d{4}-\d{2}-\d{2}$")
MSS_VER = re.compile(r"^[0-9]+\.[0-9]+$")
KEY = re.compile(r"^[a-z0-9][a-z0-9._-]{0,63}$")
TYPE = {"fact", "preference", "decision", "event"}
STATUS = {"active", "archived"}
ENTRY = re.compile(r"^- (\d{4}-\d{2}-\d{2})(?: (.+?))?(?: \{([^{}]*)\})?$")
FENCE = re.compile(r"^ {0,3}(`{3,}|~{3,})")
SECRETS = [re.compile(r"sk-[A-Za-z0-9]{10,}"),
           re.compile(r"gh[pousr]_[A-Za-z0-9]{20,}"),
           re.compile(r"AKIA[0-9A-Z]{16}"),
           re.compile(r"(?i)\b(password|token|secret|api[_-]?key)\s*=")]
ABS = [re.compile(r"(?<![A-Za-z0-9])[A-Za-z]:[\\/]"),
       re.compile(r"(^|[\s(（\[\]\"'=,<*:：])[\\/][A-Za-z0-9._-]"),
       re.compile(r"(?i)\bfile:(?=//)")]
DOTDOT = re.compile(r"(^|[/\\])\.\.(?=[/\\]|$)")
LEVEL = {"S1": 0, "S2": 0, "S3": 0, "S4": 0, "S5": 0, "S8": 0, "S11": 0, "S13": 0,
         "S6": 1, "S7": 2, "S9": 2, "S12": 2, "S10": 3, "P1": -1, "X1": -1}


def unescape(s):
    out, i = [], 0
    while i < len(s):
        if s[i] == "\\" and i + 1 < len(s) and s[i + 1] in "\\{}":
            out.append(s[i + 1])
            i += 2
        else:
            out.append(s[i])
            i += 1
    return "".join(out)


def parse_meta(raw):
    meta = {}
    for part in raw.split(", "):
        if "=" not in part:
            return None
        k, v = part.split("=", 1)
        k, v = k.strip(), v.strip()
        if not k or not v or k in meta:
            return None
        meta[k] = v
    return meta


def scan(path, root, issues, kind):
    """kind: 'main'（核心/专题）或 'timeline'。返回 (entries, unclosed, timeline_count)。"""
    data = path.read_bytes()
    text = data.decode("utf-8", errors="replace")
    if data.startswith(b"\xef\xbb\xbf"):
        issues.append((path, "S8", "BOM"))
    if b"\r" in data:
        issues.append((path, "S8", "CRLF/CR"))
    fence = fence_len = None
    out, timeline = [], 0
    label = "S4" if kind == "timeline" else "S5"
    for no, line in enumerate(text.split("\n"), 1):
        m = FENCE.match(line)
        if fence is None and m:
            fence, fence_len = m.group(1)[0], len(m.group(1))
            continue
        if fence is not None:
            if m and m.group(1)[0] == fence and len(m.group(1)) >= fence_len:
                fence = None
            continue
        match = ENTRY.match(line)
        if line.startswith("- "):
            if not match:
                issues.append((path, label, f"{no} 行格式不符"))
                continue
            date, body, metaraw = match.groups()
            if body is not None and body.strip() != body:
                issues.append((path, label, f"{no} 正文首尾空白"))
            if kind == "timeline":
                timeline += 1
            meta = parse_meta(metaraw) if metaraw else {}
            if meta is None:
                issues.append((path, label, f"{no} 元数据语法"))
                continue
            for k in meta:
                if k not in ALLOWED:
                    issues.append((path, label, f"{no} 未知键 {k}"))
            if "key" in meta and not KEY.match(meta["key"]):
                issues.append((path, label, f"{no} key 非法"))
            if meta.get("type", "fact") not in TYPE:
                issues.append((path, label, f"{no} type 非法"))
            if meta.get("status", "active") not in STATUS:
                issues.append((path, label, f"{no} status 非法"))
            for k in ("valid", "superseded"):
                if k in meta and not DATE.match(meta[k]):
                    issues.append((path, label, f"{no} {k} 日期形状"))
            if "src" not in meta:
                if kind == "main":
                    issues.append((path, "S10", f"{no} 缺 src"))
            else:
                src = re.sub(r":\d+$", "", meta["src"])
                if "\\" in src or ".." in src.split("/") or src.startswith("/"):
                    issues.append((path, label, f"{no} src 值域"))
                    issues.append((path, "S10", f"{no} src 非法"))
                elif not (root / src).exists():
                    issues.append((path, "S10", f"{no} src 不存在 {src}"))
            out.append((no, date, unescape(body or ""), meta))
        probe = unescape(line) if line.startswith("- ") else line
        if any(r.search(probe) for r in ABS) or DOTDOT.search(probe):
            issues.append((path, "S9", f"{no} 本地绝对/越界路径"))
        if any(r.search(line) for r in SECRETS):
            issues.append((path, "P1", f"{no} 疑似凭据"))
    if kind == "timeline" and fence is not None:
        issues.append((path, "S4", "围栏未闭合"))
    return out, fence is not None, timeline


def check_mss_json(root, issues):
    p = root / "mss.json"
    if not p.is_file():
        return
    try:
        obj = json.loads(p.read_text("utf-8-sig"))
    except Exception as e:
        issues.append((p, "S11", f"JSON 非法 {e.__class__.__name__}"))
        return
    if not isinstance(obj, dict):
        issues.append((p, "S11", "顶层不是对象"))
        return
    if not isinstance(obj.get("mss"), str) or not MSS_VER.match(obj.get("mss", "")):
        issues.append((p, "S11", "mss 缺失或形状非法"))
    if "store" in obj and obj["store"] not in {"L0", "L1", "L2", "L3"}:
        issues.append((p, "S11", "store 值域非法"))
    if "limits" in obj:
        lim = obj["limits"]
        if not isinstance(lim, dict):
            issues.append((p, "S11", "limits 不是对象"))
        else:
            for k, v in lim.items():
                if k not in ("core", "topic"):
                    issues.append((p, "S11", f"limits 未知键 {k}"))
                elif not isinstance(v, int) or isinstance(v, bool) or not (1 <= v <= 1000000):
                    issues.append((p, "S11", f"limits.{k} 非法"))


def declared_level(root):
    p = root / "mss.json"
    if not p.is_file():
        return None
    try:
        v = json.loads(p.read_text("utf-8-sig")).get("store")
        return v if v in {"L0", "L1", "L2", "L3"} else None
    except Exception:
        return None


def main():
    args = [a for a in sys.argv[1:] if not a.startswith("--")]
    as_json = "--json" in sys.argv
    if not args:
        print(__doc__)
        return 2
    root = Path(args[0])
    issues = []
    check_mss_json(root, issues)

    core = root / "MEMORY.md"
    cl = root / "CHANGELOG.md"
    topics = sorted((root / "memory").rglob("*.md")) if (root / "memory").is_dir() else []
    all_entries, unclosed, timeline = [], False, 0
    for f, kind in ([(core, "main")] if core.is_file() else []) + [(t, "main") for t in topics] + ([(cl, "timeline")] if cl.is_file() else []):
        ents, bad, tl = scan(f, root, issues, kind)
        unclosed = unclosed or bad
        timeline += tl
        all_entries.extend((f, *e) for e in ents)

    if (root / "_state").is_dir():
        for f in sorted((root / "_state").rglob("*")):
            if not f.is_file():
                continue
            try:
                text = f.read_text("utf-8", errors="replace")
            except Exception:
                continue
            for no, line in enumerate(text.split("\n"), 1):
                if line.startswith("- ") and DATE.match(line[2:12]):
                    issues.append((f, "S1", f"{no} 含条目行"))

    def bad(cid):
        return any(i[1] == cid for i in issues)

    def detail(cid):
        return "; ".join(f"{i[0].name}:{i[2]}" for i in issues if i[1] == cid)[:180]

    checks = []

    def add(cid, ok, d=""):
        checks.append({"id": cid, "ok": ok, "detail": d})

    add("S1", not bad("S1"), detail("S1"))
    add("S2", core.is_file())
    add("S3", (root / "memory").is_dir())
    add("S4", cl.is_file() and not bad("S4"), detail("S4"))
    add("S5", not bad("S5"), detail("S5"))
    keys = {}
    for _, no, date, body, meta in all_entries:
        if "key" in meta and meta.get("status", "active") != "archived" and "superseded" not in meta:
            keys.setdefault(meta["key"], []).append(no)
    dup = [k for k, v in keys.items() if len(v) > 1]
    add("S6", not dup, ",".join(dup)[:180])
    core_bytes = len(core.read_bytes().replace(b"\xef\xbb\xbf", b"")) if core.is_file() else 0
    add("S7", core_bytes <= 10240, f"{core_bytes} bytes")
    add("S8", not bad("S8"), detail("S8"))
    add("S9", not bad("S9"), detail("S9"))
    add("S10", not bad("S10"), detail("S10"))
    add("S11", not bad("S11"), detail("S11"))
    add("S12", (max([len(p.read_bytes()) for p in topics]) if topics else 0) <= 12288,
        f"max {max([len(p.read_bytes()) for p in topics]) if topics else 0} bytes")
    add("S13", not unclosed)
    add("P1", not bad("P1"), detail("P1"))

    by_id = {c["id"]: c for c in checks}
    verified = "none"
    for lvl, rules in [("L0", ["S1", "S2", "S3", "S4", "S5", "S8", "S11", "S13"]),
                       ("L1", ["S6"]), ("L2", ["S7", "S9", "S12"]), ("L3", ["S10"])]:
        if all(by_id[r]["ok"] for r in rules):
            verified = lvl
        else:
            break
    declared = declared_level(root)
    x1_ok = declared is None or (verified != "none" and declared <= verified)
    checks.append({"id": "X1", "ok": x1_ok,
                   "detail": "" if x1_ok else f"declared {declared} > verified {verified}"})
    order = [f"S{i}" for i in range(1, 14)] + ["P1", "X1"]
    by_id = {c["id"]: c for c in checks}
    result = [by_id[i] for i in order]
    base = int(declared[1]) if declared else 0
    errors = sum(1 for c in result
                 if not c["ok"] and (LEVEL.get(c["id"], 0) <= base or c["id"] == "P1"))
    conformant = errors == 0 and (declared is None or declared <= verified)
    report = {
        "reportVersion": "1",
        "spec": "mss/1.0",
        "store": {"declared": declared, "verified": verified},
        "conformant": conformant,
        "errors": errors,
        "warns": 0,
        "checks": [{"id": c["id"],
                    "severity": "error" if (LEVEL.get(c["id"], 0) <= base or c["id"] in ("P1", "X1")) else "info",
                    "ok": c["ok"], "detail": c["detail"]} for c in result],
        "metrics": {"coreBytes": core_bytes, "coreLimit": 10240, "topicLimit": 12288,
                    "topicBytesMax": max([len(p.read_bytes()) for p in topics]) if topics else 0,
                    "entries": len(all_entries), "topics": len(topics), "timelineEntries": timeline},
    }
    if as_json:
        print(json.dumps(report, ensure_ascii=False, indent=2))
    else:
        print(f"结构自检：{root}")
        print(f"  三件项：MEMORY.md {'ok' if by_id['S2']['ok'] else 'FAIL'}  "
              f"memory/ {'ok' if by_id['S3']['ok'] else 'FAIL'}  CHANGELOG.md {'ok' if by_id['S4']['ok'] else 'FAIL'}")
        print(f"  条目：{len(all_entries)}  专题：{len(topics)}  核心：{core_bytes}B  时间线：{timeline}")
        failures = [c for c in result if not c["ok"]]
        if failures:
            for c in failures:
                print(f"  [x] {c['id']} {c['detail']}")
        else:
            print("  [ok] 结构检查全部通过")
        print(f"  实测等级：{verified}")
    return 0 if errors == 0 else 1


if __name__ == "__main__":
    sys.exit(main())

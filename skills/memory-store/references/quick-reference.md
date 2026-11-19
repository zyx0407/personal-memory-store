# MSS 1.0 速查

## 规则

| 规则 | 一句话 | 等级 |
| --- | --- | --- |
| S1 | 文本是唯一真源；`_state/` 不含条目行 | L0 |
| S2 | `MEMORY.md` 存在且是常规文件 | L0 |
| S3 | `memory/` 存在且是目录 | L0 |
| S4 | `CHANGELOG.md` 存在、行合法、围栏闭合 | L0 |
| S5 | 条目符合 §6.2 与 §6.3 | L0 |
| S6 | 同 `key` 至多一个当前条目 | L1 |
| S7 | 核心 ≤ coreLimit | L2 |
| S8 | UTF-8、无 BOM、LF | L0 |
| S9 | 无盘符/UNC/根路径/`..` 越界/`file:` | L2 |
| S10 | 每个条目有 `src` 且文件存在 | L3 |
| S11 | `mss.json` 合法 | L0 |
| S12 | 单个专题 ≤ topicLimit | L2 |
| S13 | 围栏代码块闭合 | L0 |
| P1 | 无凭据/手机号/身份证号 | 全局 |
| X1 | 声明等级 ≤ 实测 | 全局 |

## 等级

L0 = S1–S5+S8+S11+S13；L1 = +S6；L2 = +S7+S9+S12；L3 = +S10。
`verified` = 满足的最高等级；`none` = L0 未满足；`conformant` = 达到声明等级且 `errors=0`。

## 报告

```json
{
  "reportVersion": "1",
  "spec": "mss/1.0",
  "store": { "declared": "L2", "verified": "L1" },
  "conformant": false,
  "errors": 2,
  "warns": 0,
  "checks": [ { "id": "S9", "severity": "error", "ok": false, "detail": "MEMORY.md:14 F:/" } ],
  "metrics": {
    "coreBytes": 9216, "coreLimit": 10240,
    "topicLimit": 12288, "topicBytesMax": 12000,
    "entries": 40, "topics": 6, "timelineEntries": 118
  }
}
```

- `checks` 顺序：S1…S13、P1、X1。
- 规则等级 ≤ 声明等级：`severity=error`；高于声明等级：`info`。
- `errors` 只数 `severity=error && ok=false`。

## 退出码

0 无错 / 1 有错 / 2 用法 / 3 不是库 / 4 读失败 / 5 版本不兼容。

## 条目语法（简版）

```
- YYYY-MM-DD [正文][ {key=…, type=…, src=…, valid=…, status=…, superseded=…}]
```

- 四种形态：只有日期 / 日期+正文 / 日期+正文+元数据 / 日期+元数据。
- 键：`key`、`type`（fact/preference/decision/event）、`src`、`valid`、`status`（active/archived）、`superseded`。
- `src`：相对库根、`/` 分隔、可带 `:行号`、不得含 `..`。

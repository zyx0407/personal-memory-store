---
name: memory-store
description: 给 agent 搭、养、体检「个人长期记忆库」：纯文本核心（MEMORY.md）＋分片（memory/）＋时间线（CHANGELOG.md）＋可删可重建的派生层，遵循 Memory Store Specification 1.0（L0–L3、S1–S13、init/doctor）。用于建库、写条目、迁移记忆、判定等级、排查不合规。
whenToUse: 用户说“给 agent 搭长期记忆 / 记忆库 / MEMORY.md / 记忆迁移 / 记忆体检 / 记忆规范”时；需要按 MSS 建库、写条目、自检或判级时；要把 Mem0、Letta、Zep 等记忆导出成可搬运文本时。
---

# 个人记忆库（MSS 1.0）

一句话：**核心一份 `MEMORY.md` 每轮注入，细节放 `memory/` 按需读，`CHANGELOG.md` 只追加，`_state/` 可删可重建。** 规范全文见 `SPEC.md`，本技能是干活用的最短路径。

## 前置检查

1. **纯文本**：不需要数据库；任何语言都能实现 `doctor`。
2. **三件项**：库根下 `MEMORY.md`、`memory/`、`CHANGELOG.md`；可选 `mss.json`、`_state/`。
3. **自检脚本**：Python 3.8+（`scripts/check.py`，结构自检，非规范级 doctor）。
4. **编码**：全部 UTF-8、无 BOM、LF；文件名大小写敏感。

## 工作流

### 第一步：建库

```
<root>/
  MEMORY.md          # 核心，每轮注入；≤ coreLimit
  memory/            # 分片，按需读；每个文件 ≤ topicLimit
  CHANGELOG.md       # 时间线，只追加
  mss.json           # 可选：声明等级与上限
  _state/            # 可选：索引、报告、缓存；可删
```

最小起步：把 `assets/MEMORY.md`、`assets/mss.json`、`assets/topic.md` 复制进库根并按需改名。

### 第二步：写条目

条目只能出现在核心区与专题区，行格式四选一：

```
- 2026-11-19 事实正文
- 2026-11-19 事实正文 {key=release.decision, type=decision, src=memory/项目-发布.md:28}
- 2026-11-19 {key=person.name, type=fact}
```

规则（违反即不合规）：

- 日期 `YYYY-MM-DD`，只校验形状；正文非空；元数据组前恰一个空格。
- 元数据：`, ` 分隔、`=` 两侧无空格；键只允许 `key, type, src, valid, status, superseded`。
- 同 `key` 全库只能有一个「当前条目」：旧的写 `status=archived, superseded=<日期>`，**保留正文**。
- `src` 指向库内文件（可带 `:行号`），L3 要求 100% 覆盖。
- 正文里的 `{`、`}` 要写成 `\{`、`\}`；行尾 `\r` 不允许（CRLF 不合格）。

### 第三步：自检

```bash
python scripts/check.py <root>          # 人读摘要
python scripts/check.py <root> --json   # JSON（结构自检，非规范 doctor）
```

检查：三件项、编码、围栏闭合、条目语法、键唯一、核心/分片预算、`src` 存在、绝对路径、疑似凭据。按输出逐条修。

### 第四步：判级与声明

| 等级 | 要求 | 含义 |
| --- | --- | --- |
| L0 | S1–S5、S8、S11、S13 | 能读：结构、条目、编码成立 |
| L1 | +S6 | 键唯一，可维护 |
| L2 | +S7、S9、S12 | 有预算、无本地绝对路径 |
| L3 | +S10 | 每个条目有来源 |

在 `mss.json` 写 `{"mss":"1.0","store":"L2","limits":{"core":10240,"topic":12288}}` 即声明；实际等级由 `doctor` 实测，声明高于实测会报 X1。

### 第五步：维护

- **核心超限**：先删/合并结论，不截断注入。
- **分片超限**：拆成两个专题，核心索引各一行。
- **改事实**：新条目 + 旧条目 `superseded`，不要直接改历史。
- **备份/迁移**：复制 `MEMORY.md`、`memory/`、`CHANGELOG.md`、`mss.json`，**不要带** `_state/`。
- **清理**：`_state/` 整个删掉，下次索引重建。

## 关键口径

| 项 | 口径 |
| --- | --- |
| 核心限额 | 默认 10240 字节，`mss.json` 的 `limits.core` 可改 |
| 分片限额 | 默认 12288 字节/文件 |
| 条目日期 | 写入日期或事实发生日期；`valid` 单独记生效日 |
| 当前条目 | 未标 `superseded` 且 `status != archived` |
| 删除 | 只改状态为 `archived` 并留一条 `CHANGELOG`，不删正文 |
| 注入 | 每轮注入核心全文；压缩后重注入；分片不自动注入 |
| 报告 | `doctor` 输出 JSON；退出码 0 无错 / 1 有错 / 2 用法 / 3 不是库 / 4 读失败 / 5 版本不兼容 |

## 常见坑

- **JSON 里写中文路径**：`src` 允许 Unicode，但必须 `/` 分隔，不能 `\`。
- **把 `_state/` 当正文**：派生层不能出现条目行；删掉它库仍要可读。
- **同 key 两条都没标**：S6 失败，且 `doctor` 只认一条当前值。
- **CRLF**：Windows 记事本保存会带 `\r`，S8 直接失败；保存成 LF。
- **围栏没闭合**：一个多余的 ``` 会让后面全部内容不算条目，S13 报错。
- **声明 L3 但没写 `src`**：X1 报「声明高于实测」，降到 L2 或补齐来源。
- **正文裸花括号**：`{`/`}` 必须转义，否则 S5 失败。

## 边界

- 只定义**格式与只读校验**；写入命令、向量库、图数据库、加密、多用户并发不在规范内。
- `_state/` 的实现自由，但不得成为记忆的唯一副本。
- 本技能自带的是**结构自检**，不是规范级 `doctor`；正式判定以 `SPEC.md` 为准。

## 文件与许可

| 文件 | 用途 |
| --- | --- |
| `../../SPEC.md` | 规范全文 1.0 |
| `references/quick-reference.md` | 规则、等级、报告字段速查 |
| `references/interop.md` | Mem0／Letta／Zep／Cognee 导入导出对照 |
| `assets/MEMORY.md` | 核心模板 |
| `assets/mss.json` | 声明模板 |
| `assets/topic.md` | 专题模板 |
| `scripts/check.py` | 结构自检脚本 |
| `LICENSE` | 文本 CC BY 4.0；代码 MIT |

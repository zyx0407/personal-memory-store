# 个人记忆库规范（Personal Memory Store Specification）v1.0

| 项 | 值 |
| --- | --- |
| 状态 | 正式版（1.0.0） |
| 版本 | 1.0.0 |
| 日期 | 2026-11-19 |
| 作者 | 阿玖（zyx0407） |
| 文档许可 | CC BY 4.0 |
| 参考实现许可 | MIT |

**摘要**

本规范定义个人长期记忆库的文件格式、条目语法与只读校验方法。面向单用户（一个人、一个库、一个写入者），不涉及团队协作、多租户或云端记忆平台。符合性只针对库本身，分 `L0`–`L3` 四级。命令只有两个：`init`（建库）与 `doctor`（只读校验，输出 JSON 报告）。写入、导出、索引属于实现自由，推荐做法见附录 D。

## 1. 范围

1. 记忆库布局与编码；
2. 条目语法：日期、正文、事实键、来源、状态、转义；
3. 命令契约：`init`、`doctor`；
4. 库的一致性声明与判定。

不规定：记忆内容、模型、界面、写入流程、存储引擎、实现语言。文本文件是唯一真源。本规范面向个人（单用户）记忆库；多用户、团队协作、云端多租户与权限模型不在范围内。

## 2. 规范性内容

- 规范性内容为：本章与 §3–§6、§8、§9、§11。
- §1、§7、§10 与全部附录为非规范性。
- §9.1 规则强度全部为**必须**；实现不得把必须规则的失败记为 `warn`。必须性只对声明等级及其以下生效（§8.3.1）。

## 3. 术语

| 术语 | 定义 |
| --- | --- |
| 记忆库（store） | 一个根目录；三件项（`MEMORY.md`、`memory/`、`CHANGELOG.md`）中至少一项存在即视为库 |
| 库文件 | `MEMORY.md`、专题区中的全部文件、`CHANGELOG.md`、`mss.json`（若存在）；文件名与扩展名大小写敏感 |
| 核心区 | `MEMORY.md` |
| 专题区 | `memory/` 下扩展名为小写 `.md` 的**常规文件**（含子目录）；忽略任意层级以 `.` 开头的文件或目录；忽略符号链接、重解析点与特殊文件 |
| 时间线 | `CHANGELOG.md` |
| 派生层 | `_state/`（实现自由使用，内容不属于记忆；只读取其中目录项自身类型为常规文件的内容，忽略符号链接与特殊文件） |
| 围栏代码块 | 由 §6.4 定义的块；块内行不参与条目、变更记录与 P1/S9 扫描（S13 需见围栏行） |
| 条目 | 核心区与专题区中、围栏代码块外、以 `- ` 开头的行 |
| 变更记录 | 时间线中、围栏代码块外、以 `- ` 开头的行 |
| 当前条目 | 未标 `superseded`（该值域非法时视为未标）且 `status` 不为 `archived` 的条目 |
| 测量字节 | 文件的原始字节数，仅去掉 BOM；不重新编码 |
| 今天 | 执行命令时所在机器的本地日期（实现时区） |
| harness | 调用模型并在每轮提供上下文的宿主程序 |

## 4. 一致性声明

### 4.1 `mss.json`

库根可含 `mss.json`（UTF-8、无 BOM、LF）：

```json
{
  "mss": "1.0",
  "store": "L2",
  "limits": { "core": 10240, "topic": 12288 }
}
```

- `mss` 必填，必须是字符串且匹配 `^[0-9]+\.[0-9]+$`，否则 S11 失败。
- `declared` 只由 `store` 决定：`store` 为 `L0`–`L3` 时取该值；`store` 键不存在时为 `null` 且**不**使 S11 失败；`store` 为其它任何值（含 `null`、非字符串）时 `null` 且使 S11 失败。
- `limits` 必须是对象；只允许 `core`、`topic` 两个键，未知键使 S11 失败。`limits.core`、`limits.topic` 必须是 1–1,000,000 的数学整数（JSON 数字，`10240.0` 视为整数，`1e4` 视为 10000；小数、字符串、布尔、`null` 非法）；键不存在时取 §5.2 默认值且不判失败，值非法时取 §5.2 默认值并使 S11 失败（不影响 `declared`）。
- `mss.json` 出现重复键按非法 JSON 处理（§8.1 ③）。顶层未知键忽略；`limits` 内的未知键使 S11 失败。
- 机器可读 schema：`schema/mss.schema.json`；报告 schema：`schema/report.schema.json`（随发布提供，与正文冲突时以正文为准）。

### 4.2 报告中的声明

报告输出 `store.declared`、`store.verified` 与 `conformant`；`declared` 见 §4.1，其余见 §9.2。

## 5. 存储模型

### 5.1 路径

| 路径 | 必需 | 说明 |
| --- | --- | --- |
| `MEMORY.md` | 是 | 核心区 |
| `memory/` | 是 | 专题区，可空 |
| `CHANGELOG.md` | 是 | 时间线 |
| `mss.json` | 否 | 声明 |
| `_state/` | 否 | 派生层，可删可重建 |

### 5.2 生效上限

`coreLimit` = `mss.json` 的 `limits.core`（缺失或非法时 10240）；`topicLimit` = `limits.topic`（缺失或非法时 12288）。两字段独立判断；报告中的 `coreLimit`、`topicLimit` 必须是生效值。

## 6. 条目语法与编码

### 6.1 编码

- 库文件必须是 UTF-8、无 BOM、LF 行尾（判据见 S8）；末尾 LF 数量不受限。行尾 `\r` 保留为行内容，由 S8 判失败。

### 6.2 行格式

条目与变更记录必须是下列四种形态之一（`<日期>` 为 `YYYY-MM-DD`，且整 token 匹配 `^[0-9]{4}-[0-9]{2}-[0-9]{2}$`，只校验形状、不校验日历）：

```
- <日期>
- <日期> <正文>
- <日期> <正文> {<元数据>}
- <日期> {<元数据>}
```

- 日期后只允许下列之一：行尾；一个 U+0020 加非空正文；一个 U+0020 加元数据组；一个 U+0020 加非空正文、一个 U+0020、元数据组。
- 正文首尾不得为空白；正文与元数据组之间恰一个 U+0020；`}` 之后到行尾只允许空白。
- 元数据组至少含一个 `键=值`，且键与值均不得为空；`{`、`}` 各自的紧邻内侧不得有空白；`键=值` 必须写成 `, ` 分隔、`=` 两侧无空格。
- 反斜杠是唯一转义前导：`\\` 表示字面反斜杠，`\{`、`\}` 表示字面花括号；其它 `\x` 表示字面反斜杠加 `x`；行末孤立 `\` 表示字面反斜杠；反转义按从左到右单遍处理。
- 正文中未转义的 `{`、`}` 不得出现（按原文词法判定）。
- 元数据值不得出现 `,`、`}`、`=`；`src` 指向的文件路径不得包含这些字符。
- 只允许 §6.3 列出的键，每个键至多出现一次；否则整条不符合 §6.2。
- `status` 缺省为 `active`。
- 行内容含 CR 即不符合本节（S4/S5 失败）。
- 反转义只用于取值与 S9/P1 扫描：条目与变更记录行按反转义后的文本扫描；标题、表格、散文、`mss.json` 按原文扫描。
- 写入时的推荐输出形式见附录 D（非规范性）。
- 本规范所称「可解析行」：满足本节四种形态、空格规则、转义规则与键集要求（不含 §6.3 值域）。
- 本节的「空白」指 U+0020（空格），不含 Tab、CR 等其它字符。

### 6.3 元数据

| 键 | 取值 |
| --- | --- |
| `key` | `^[a-z0-9][a-z0-9._-]{0,63}$` |
| `type` | 可选；`fact`／`preference`／`decision`／`event`，缺省 `fact` |
| `src` | `^(?!.*\.\.)[\p{L}\p{N}._~-]+(/[\p{L}\p{N}._~-]+)*(:[0-9]+)?$`，且不得匹配 `^[A-Za-z]:`；不得含反斜杠或空段 |
| `valid` | 可选；`^[0-9]{4}-[0-9]{2}-[0-9]{2}$`，事实生效日；缺省同条目日期 |
| `status` | `active`／`archived` |
| `superseded` | `^[0-9]{4}-[0-9]{2}-[0-9]{2}$` |

### 6.4 围栏代码块

- 开栏：行首至多 3 个空格后，连续同种反引号或波浪号的**极大串**（长度 ≥3）作为围栏长度，info 字符串从极大串之后开始。
- 闭栏：同一缩进位置、同种字符的极大串、长度 ≥ 开栏长度，其后只允许 U+0020、Tab 或 CR。
- 围栏状态机不嵌套：进入块后只识别闭栏；块内出现的其它围栏形态按正文处理。
- 代码块内的行不计入条目与变更记录，也不参与 P1、S9 扫描。
- 未闭合围栏：库文件 → S13 失败；`_state/` 内文件 → S1 失败。

## 7. 注入做法（非规范性）

推荐：harness 在每轮首个模型请求前读取 `MEMORY.md` 全文放入上下文；上下文被压缩或截断后重新放入；超预算时先瘦身，不截断注入；`memory/` 不自动放入。示例见附录 B。

## 8. 命令契约

### 8.1 通用

- 命令名固定；均接受 `[--root <dir>]`，缺省为当前目录。
- `--help`/`--version` 不检查库，直接输出并退出 0。
- 标准输出只输出结果；诊断走标准错误；输出 UTF-8。
- 用法：除 `--help`/`--version`（最高优先，直接退出 0）外，无法按 §8.2 的用法解析的调用——未知命令、未知选项、选项缺值、重复选项、多余位置参数、`--root` 缺值——一律退出 2。只接受 `--root <dir>` 两个 token 的形式；`--root=<dir>` 等写法一律退出 2。
- 三件项之间的「存在」只看精确名称的目录项，不看类型；类型错误由 S2/S3/S4 报。三件项都不存在时先返回 3（`init` 除外），不读取 `mss.json`；`--root` 不存在时：`init` 递归创建，其它命令返回 3；`--root` 存在但不是目录或不可列举时返回 4（先于 3）。`_state/` 不存在或不是目录时忽略；存在但不可列举时返回 4。
- 统一解码：所有库文件按 UTF-8 解码，非法字节替换为 U+FFFD；解析前去掉文件开头的 BOM；按 `\n` 切行，行尾的 `\r` 保留为行内容（由 S8 报失败）。
- 类型检查先于读取：`MEMORY.md`/`CHANGELOG.md` 不是常规文件由 S2/S4 失败，`memory/` 不是目录由 S3 失败，`mss.json` 不是常规文件由 S11 失败；类型不符的项不参与内容类规则，也不触发退出码 4。对跨文件规则（S5/S8/S9/S13/P1）：只把类型不符的项从该规则的对象中剔除，其余文件照常判定；仅当该规则没有任何可判对象时才记 `ok=true`、detail 写 `not applicable`。`--root` 先解析为真实目录（跟随其自身链接）；库内条目按目录项自身类型判定，不跟随符号链接与重解析点。
- 退出码 4 只用于：常规文件的实际 I/O 读取失败、`memory/` 或 `_state/` 目录不可列举；此时不输出报告。
- `mss.json` 按 UTF-8 严格解码（不作 U+FFFD 替换），含非法字节或 NUL 视为非法 JSON（③）；解析前去掉文件开头的 BOM。
- `mss.json` 处理：① 不可读取（I/O）→ 退出码 4；② 不存在 → `declared=null`，S11 不适用；③ JSON 非法（含解码失败、重复键）→ `declared=null`，S11 失败，继续；④ 可读、JSON 合法但 `mss` 缺失或形状非法 → S11 失败，继续，`declared` 按 §4.1；⑤ `mss` 形状合法但版本不兼容 → 退出码 5（不输出报告）；⑥ 其余字段值域非法 → 非法字段取 §5.2 默认值、合法字段照常生效，`declared` 按 §4.1，S11 失败并继续。
- 顺序约束：先完成类型检查与全部库文件读取（4），再判 `mss.json` 的版本（5）；两者同时成立时返回 4。
- 只有 `doctor` 输出报告，且只在退出码 0、1 时输出。
- `init` 不解析 `mss.json`，不返回 5。

### 8.2 命令

| 命令 | 用法 | 行为 |
| --- | --- | --- |
| init | `mss init [--root <dir>]` | 创建缺失的 `MEMORY.md`（内容为 `# Memory` 加一个 LF）、`memory/`、`CHANGELOG.md`（内容为 `# Changelog` 加一个 LF）；`--root` 不存在时递归创建（含父目录）；不覆盖已有文件；不创建 `mss.json`；任一目标项无法就位（父目录不可写，或目标存在但类型不符，含符号链接）退出码 4；成功退出码 0 |
| `doctor` | `mss doctor [--root <dir>]` | 只读；原地检查并输出报告（8.3），不修改原库 |

### 8.3 报告

标准输出为单个 JSON 对象，末尾换行，不混入其它文本。

| 字段 | 类型 | 必填 | 取值 |
| --- | --- | --- | --- |
| `reportVersion` | string | 是 | `"1"` |
| `spec` | string | 是 | `mss/<本工具支持的规范版本>` |
| `store` | object | 是 | `{declared: "L0"–"L3"\|null, verified: "L0"–"L3"\|"none"}` |
| `conformant` | boolean | 是 | 见 §9.2 |
| `errors` | integer | 是 | 见 8.3.1 |
| `warns` | integer | 否 | 缺省 0；实现自定义建议检查的失败数 |
| `checks` | array | 是 | 每项 `{id, severity, ok, detail}`；`severity` ∈ `error`／`warn`／`info` |
| `metrics` | object | 是 | 见 8.3.2 |

**8.3.1 `checks` 与 `errors`**

- `checks` 必须覆盖 §9.1 全部规则各一项（含 `ok=true`），顺序固定为 S1、S2、S3、S4、S5、S6、S7、S8、S9、S10、S11、S12、S13、P1、X1；自定义 `W*` 排在 X1 之后。
- `severity` 由适用性决定，与 `ok` 无关：规则适用等级 ≤ `declared`（`declared=null` 按 L0）或为全局规则时一律 `error`；规则适用等级高于 `declared` 时一律 `info`。
- `errors` 必须等于 `checks` 中 `severity=error` 且 `ok=false` 的条数。
- `warns` 只统计实现自定义的 `W*` 检查（`severity` 只能是 `warn`）。
- `detail` 为单行字符串，≤200 个 Unicode 码点（超出截断加 `…`），须写明检查对象；有可量化值时给出值；格式为「不含规则号的说明」，例：`coreBytes=10240 coreLimit=9216`、`keys 12 unique`、`9 files utf-8 no bom lf`。

**8.3.2 `metrics`**

| 字段 | 类型 | 含义 |
| --- | --- | --- |
| `coreBytes` | integer | `MEMORY.md` 测量字节；不存在 0 |
| `coreLimit` | integer | 生效上限（§5.2） |
| `topicLimit` | integer | 生效上限（§5.2） |
| `topicBytesMax` | integer | 专题文件测量字节最大值；无 0 |
| `entries` | integer | 核心区与专题区中、围栏外的 `- ` 行数（不筛合法性） |
| `topics` | integer | 专题文件数 |
| `timelineEntries` | integer | 变更记录行数 |

### 8.4 退出码

| 码 | 含义 |
| --- | --- |
| 0 | 成功，`errors = 0` |
| 1 | 执行完成，但 `errors > 0` |
| 2 | 用法错误 |
| 3 | 三件项都不存在（`init` 除外） |
| 4 | 读写失败（含 `mss.json` 读取失败） |
| 5 | `mss.json` 版本不兼容（仅 `doctor`） |

判定顺序：2 → 3 → 4 → 5 → 1 → 0。`init`、`--help`、`--version` 的退出 0 不参与 `errors` 判定。

## 9. 一致性

> 正则按 **ECMAScript 2024（`u` 标志）** 语义给出：`\w`、`\b` 按 ASCII 解释；`\s` 含 Unicode 空白。实现可转译到其它引擎，但语义须一致；不支持环视的引擎须自行改写为等价逻辑（规范不提供逐引擎等价式）。

### 9.1 规则表

| 规则 | 强度 | 要求 | 判据 |
| --- | --- | --- | --- |
| S1 | 必须 | 文本是唯一真源 | `_state/` 下所有可按 §8.1 统一解码的文件（含 `manifest.json`；含 NUL 字节者整体跳过，含围栏检查），去围栏代码块后逐行扫描，不得出现「可解析行」（§6.2）；`_state/` 内出现未闭合围栏时判失败 |
| S2 | 必须 | `MEMORY.md` 存在且为常规文件 | 目录项名称逐字符（含大小写）精确匹配 + 类型为常规文件 |
| S3 | 必须 | `memory/` 存在且为目录 | 目录项名称逐字符（含大小写）精确匹配 + 类型为目录 |
| S4 | 必须 | `CHANGELOG.md` 存在且为常规文件；其变更记录符合 §6.2 与 §6.3；围栏闭合 | 精确名称 + 类型 + 行解析 + 闭合状态 |
| S5 | 必须 | 核心区与专题区中、围栏外的 `- ` 行符合 §6.2 全部子句与 §6.3 | 逐条校验形态、空格、转义、元数据键与值域 |
| S6 | 必须 | 同 `key` 至多一个当前条目（全库范围） | 仅对核心区与专题区围栏外的「可解析行」（不含变更记录）做键聚合；`key` 值域非法的行不参与 |
| S7 | 必须 | `coreBytes ≤ coreLimit` | 字节比较（`coreLimit` 见 §5.2） |
| S8 | 必须 | 库文件为 UTF-8、无 BOM、LF | 字节检测；末尾 LF 数量不受限 |
| S9 | 必须 | 库文件中不出现盘符路径、UNC、根路径与越界路径 | 逐文件按 UTF-8 路径字节序遍历；先以空行替换围栏块（保留原行号）；条目/变更记录行取反转义文本、其余行取原文；按序命中即失败：① `\bfile:(?=//)`（`i`）② `(?<![A-Za-z0-9])[A-Za-z]:[\\/]` ③ `(^|[\s(（\[\]"'=,<*:：\x60])\\\\[A-Za-z0-9._-]` ④ `(^|[\s(（\[\]"'=,<*:：\x60])\\[A-Za-z0-9._-]` ⑤ `(?<![\w:])//[A-Za-z0-9._-]`；然后删除 `(?<![A-Za-z0-9])[A-Za-z][A-Za-z0-9+.-]{1,}://\S+`，再匹配 ⑥ `(^|[\s(（\[\]"'=,<*:：\x60])/(?=[^\s/])` ⑦ `(^|[/\\])\.\.(?=[/\\]|$)`；detail 报首个命中 `库根相对路径:行号 <匹配到的路径 token>`，另有命中写 `(+N more)` |
| S10 | 必须 | 每个条目带 `src`，且所指文件在库内存在 | 仅对核心区与专题区围栏外的「可解析行」（不含变更记录）统计：`src` 值域非法的行按未覆盖计为失败；值域合法时剥离末尾 `:<数字>`、以库根为基准、按 `/` 分段逐段精确匹配（大小写敏感，不做分隔符归一化），目标必须为库根内常规文件；覆盖全部行（含 `archived` 与 `superseded`）；0 行时通过；否则覆盖率须 100% |
| S11 | 必须 | `mss.json` 若存在：可解析、`mss` 存在且形状合法、`store`（若出现）与 `limits` 值域合法 | 逐项 schema 校验；不可解析判失败；不存在时不适用（`ok=true`）；`store` 缺失不判失败 |
| S12 | 必须 | `topicBytesMax ≤ topicLimit` | 字节比较（`topicLimit` 见 §5.2） |
| S13 | 必须 | 每个库文件的围栏代码块均已闭合 | 状态机扫描每个库文件 |

全局规则（不属任何等级，失败计入 `errors`）：

| 规则 | 强度 | 要求 | 判据 |
| --- | --- | --- | --- |
| P1 | 必须 | 库文件中无凭据与敏感字段 | 以 `i` 标志匹配，以空行替换围栏块（保留原行号）、反转义条目行后扫描全部库文件：`(sk-[A-Za-z0-9]{10,}|gh[pousr]_[A-Za-z0-9]{20,}|AKIA[0-9A-Z]{16}|xox[baprs]-[A-Za-z0-9-]{10,}|(?<![0-9])1[3-9][0-9]{9}(?![0-9])|(身份证|id\s*card)[^\n]{0,20}[0-9]{17}[0-9Xx]|\b(password|token|secret|api[_-]?key)\s*=)`；detail 报首个命中 `库根相对路径:行号`（不回显内容），另有命中写 `(+N more)` |
| X1 | 必须 | 声明等级不得高于实测 | `declared != null` 且（`verified="none"` 或 `declared > verified`）时失败；`detail` 为 `declared <declared> > verified <verified>` |

### 9.2 等级

每一级都要求本级与更低等级的全部规则通过：

| 等级 | 该级新增规则 |
| --- | --- |
| L0 | S1、S2、S3、S4、S5、S8、S11、S13 |
| L1 | S6 |
| L2 | S7、S9、S12 |
| L3 | S10 |

- 规则适用等级＝其所在等级号；全局规则无等级。
- `store.verified` = 满足的最高等级；`none` 表示低于 L0。
- `conformant` = 达到声明等级（`declared=null` 时按 L0）且 `errors == 0`；即 `conformant` 是相对声明等级的判断，不代表达到更高等级。

### 9.3 判定

1. `doctor` 检查全部规则（含 `ok=true`），按 8.3.1 计 `errors`，按 9.2 计 `verified` 与 `conformant`。
2. 声明高于实测时，`checks` 含 `{id:"X1", severity:"error", ok:false}` 并计入 `errors`。
3. 全局规则失败计入 `errors`，不改变等级。

## 10. 安全与隐私（非规范性）

- P1 见 §9.1。
- 未获使用者明确授权时不得传输记忆内容。

## 11. 版本与兼容

- 版本 `主.次`。
- **正式版 1.0**：`mss` 主版本为 `1` 即兼容（接受 `1.x`）；主版本不同则 `doctor` 退出码 5。规则文本冻结于 1.0.0；勘误不改规则语义，规则变更进入新主版本。
- 1.0 起：主版本一致即可；主版本变化表示不兼容变更，新增或收紧规则必须进入新主版本。

## 附录 A 参考取值（非规范性）

结构图：`docs/architecture-zh.png`（中文）、`docs/architecture-en.png`（英文），非规范性。

| 项 | 作者自用取值 |
| --- | --- |
| `limits.core` | 10240 字节 |
| `limits.topic` | 12288 字节 |
| 核心区超限策略 | 先瘦身再写，不截断注入 |
| 读取顺序 | 注入核心 → 按需读专题 |
| 未命中 | 返回空结果，不猜测 |
| 写入并发 | 同一时刻只允许一个进程写库（非规范性） |

## 附录 B 接入示例（非规范性）

| 环境 | 做法 |
| --- | --- |
| DeepSeek Harness | 每轮读取 `MEMORY.md` 全文放入上下文 |
| Claude Code | 每轮读取 `MEMORY.md` 全文放入上下文 |
| Codex | 每轮读取 `MEMORY.md` 全文放入上下文 |

## 附录 C 样例（非规范性）

**合法条目**

```
- 2026-11-15 记忆库改为直接开源 {key=opensource.decision, src=memory/项目-发布.md:28}
- 2026-11-14 {key=opensource.decision, src=memory/项目-发布.md:24, status=archived, superseded=2026-11-15}
```

**非法条目**

```
- 记忆库改为直接开源                              ← 缺日期
- [2026-11-15] 记忆库改为直接开源                  ← 日期形状不符
- 2026-11-15 记忆库改为直接开源 {key=Open Source}  ← 键含空格与大写
```

**doctor 报告（声明 L2，实测 L1；S9 失败）**——`checks` 覆盖全部 15 条规则：

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

## 附录 D 写入与导出建议（非规范性）

规范不定义写入命令。作者自用实现的做法，供参考：

- `index --rebuild`：生成 `_state/manifest.json`，内容为库文件路径与 sha256。
- 写入条目的推荐形式：元数据 `, ` 分隔、`=` 两侧无空格、键序 `key, type, src, valid, status, superseded`。
- `write <file>`：把输入条目写入 `memory/<topic>.md`；同 `key` 的当前条目改为 `status=archived, superseded=<今天>`；缺 `src` 时补输入文件相对库根的路径（输入不在库内则补 `memory/<topic>.md`）；每条写入在 `CHANGELOG.md` 记一行。
- `delete --key <k> --yes`：只改状态为 `archived` 并记一行变更记录，不删除正文。
- `export --out <dir>`：按库根结构复制库文件，不含 `_state/`。

## 附录 E 与开源记忆系统的对照（非规范性）

| 系统 | 模型要点 | 对应到本规范 |
| --- | --- | --- |
| Mem0 | 事实级记忆＋metadata＋`user_id`/`agent_id`/`run_id` 作用域；ADD/UPDATE/DELETE | 一条条目＝一个事实；`type` 区分事实与偏好；作用域用「一户一库根」，不塞进条目；`superseded` 保留更新/删除的历史 |
| Letta / MemGPT | 可自编辑的核心记忆块＋recall/archival 分层 | 核心区＝核心块；专题区＝archival；`status`/`superseded` 记录自编辑轨迹 |
| Zep / Graphiti | 双时态知识图：`valid_at`/`invalid_at`/`created_at`＋episode | 条目日期＝记录时间；`valid`＝事实生效日；`superseded`≈`invalid_at`；`src` 锚定 episode |
| Cognee | ECL 管道、图＋向量、dataset | 库根＝dataset；图/向量只做派生层，文本仍是真源 |
| MemOS | MemCube：明文／激活／参数 | 明文＝库文件；激活与参数＝派生层，可删可重建 |

1.0 采纳的改进：`type`（typed memory）、`valid`（双时态的最小化）、多库根＝多作用域、派生层可重建；不采纳：把向量/图作为唯一真源、把 scope 写进每条正文。

## 附录 F 变更记录

| 版本 | 日期 | 变更 |
| --- | --- | --- |
| 0.1–0.11 | 2026-11-15 | 见前版；经八轮外审迭代 |
| 0.12 | 2026-11-15 | 按第九轮外审：`declared` 只由 `store` 决定；`doctor`/`verify` 合并为 `doctor`；新增 S13（围栏闭合）；`checks` 增加 `info` 严重度并据此计 `errors`；`file:`/盘符先于 URL 剥离；S9 detail 与遍历序固定；P1 不回显命中内容；空正文+元数据形态；反转义只施于条目行；`--version` 令牌统一；样例重算 |
| 0.13 | 2026-11-15 | 按第十轮外审：日期形状判据移入 §6.2；四种行形态；`src` 值域正则；S5 严格形态判定；S9 先剔围栏、两种分隔符、协议相对引用与引号上下文；S2/S3/S4 精确名称匹配；`store` 缺失不判 S11 失败；`--help`/`--version` 短路；`checks` 固定顺序与 detail 模板；样例补值；README 指向 §7 与附录 D |
| 0.14 | 2026-11-15 | 按第十一轮外审：`src` 允许 Unicode；行语法改为四形态 + 空格/正文/元数据组细则；S4 同查 §6.3；S2/S3/S4 校验类型；S1 按行形态判；`entries` 口径；`--root` 不可列举与库文件读失败归 4；`severity` 必须性范围；S9 命中 token 定义；P1 detail 对齐；并发移入附录 |
| 0.15 | 2026-11-15 | 按第十二轮外审：读失败与类型不符分家；围栏状态机不嵌套、`_state` 未闭合归 S1；`key`/`src`/`superseded` 正则锚定与方言；`limits` 逐字段回退；S5/S6/S10 只统计可解析行；S9 盘符/UNC/根路径/越界重写并补反引号等上下文；P1 保留行号；`detail` 去规则号；`conformant` 相对声明等级 |
| 0.16 | 2026-11-15 | 按第十三轮外审：`mss.json` 解码与 BOM、`limits` 类型与未知键、`--root` 类型与顺序、类型不符不触发 4、`init` 目标冲突归 4、S10 目标为常规文件、S6/S10 只统计可解析行 |
| 0.17 | 2026-11-15 | 按第十四轮外审：S6/S10 排除变更记录；闭栏尾随字符；S1 统一解码与「可解析行」；版本串钉死为 0.17；S9 补 UNC 与反斜杠根路径；类型检查先于读取；用法错误清单与优先级；JSON 数字/重复键/`superseded` 非法值口径；符号链接不跟随；`init` 递归建目录 |
| 0.18 | 2026-11-15 | 按终审门禁：`mss` 缺失/非法按 §8.1 ③④ 处理、版本串钉 0.18；围栏取极大串；专题区与 `_state` 只读常规文件；类型不符项记 not applicable；三件项「存在」按目录项名不看类型；S10 非法 `src` 计未覆盖并逐段精确匹配；顶层未知键忽略、`limits` 内未知键失败；行末孤立反斜杠；CRLF 与末尾 LF 口径；`--root` 只接受两 token；`init` 目标类型不符归 4 |
| 1.0.0 | 2026-11-19 | 正式版：以 v0.18 为基线冻结规则集；新增可选键 `type`（fact/preference/decision/event）与 `valid`（事实生效日）；发布 JSON Schema、技能包、CHANGELOG 与双许可；新增附录 E（与 Mem0／Letta／Zep／Cognee／MemOS 的对照）；版本策略改为 `1.x` 兼容 |

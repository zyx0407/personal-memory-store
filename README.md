# 个人记忆库规范（Personal Memory Store Specification）

一套给**个人**用的长期记忆库规范：一个人、一个库、一台能碰盘的 harness，把「我是谁、我经历过什么、我为什么这么决定」写成可搬家的纯文本。核心一份 `MEMORY.md` 每轮注入，细节放 `memory/` 按需读，`CHANGELOG.md` 只追加，`_state/` 可删可重建。

不面向团队协作、多租户或云端记忆平台；那些场景需要的作用域、并发与权限，不在本规范内。

**正式版 1.0.0**（2026-11-19）。

## 文档

| 文件 | 内容 |
| --- | --- |
| [`SPEC.md`](SPEC.md) | 规范正文 1.0（中文）：L0–L3、S1–S13、P1、X1；`init` + `doctor` |
| [`SPEC.en.md`](SPEC.en.md) | 规范正文 1.0（English） |
| [`schema/mss.schema.json`](schema/mss.schema.json) | `mss.json` 的 JSON Schema |
| [`schema/report.schema.json`](schema/report.schema.json) | `doctor` 报告的 JSON Schema |
| [`skills/memory-store/SKILL.md`](skills/memory-store/SKILL.md) | 可安装到 DSH 的技能包（建库／写条目／自检／迁移） |
| [`docs/architecture-zh.png`](docs/architecture-zh.png) · [`docs/architecture-en.png`](docs/architecture-en.png) | 四区结构图（中文／英文） |
| [`CHANGELOG.md`](CHANGELOG.md) | 版本变更 |
| [`LICENSE`](LICENSE) | 文本 CC BY 4.0；代码与技能 MIT |

## 怎么读

- **想实现一个记忆库**：读 §3–§9、§11；按 §9.1 自检，按 §4.1 在 `mss.json` 声明等级。
- **想接进自己的 harness**：读 §7 与附录 B（非规范性建议）。
- **想直接用**：装技能包 `skills/memory-store/`，按 SKILL.md 五步走；结构自检跑 `python skills/memory-store/scripts/check.py <库根>`。

## 最小起手

```
<root>/
  MEMORY.md
  memory/
  CHANGELOG.md
  mss.json          # 可选
```

`mss.json`：

```json
{ "mss": "1.0", "store": "L2", "limits": { "core": 10240, "topic": 12288 } }
```

条目：

```
- 2026-11-19 记忆库改为直接开源 {key=opensource.decision, type=decision, src=memory/项目-发布.md:28}
```

## DSH 插件

[`dsh-plugin/dsh-personal-memory-store/`](dsh-plugin/dsh-personal-memory-store/) 是一个 DSH Host 插件包，注册两个工具：

- `memory_init(root)`：建库骨架
- `memory_doctor(root, format)`：按 1.0 规范体检，返回 JSON 报告或文字摘要

安装：DSH **Plugins → Add plugin → 选本地目录**，或 `plugin_manager install_bundle` 指向该目录。已在作者本机装测（2026-11-19）；npm 包名 `dsh-personal-memory-store` 已预留，尚未发布。

## 参考实现

作者自用的实现（`mss` 命令行、记忆体检、索引脚本）不在本仓库内；本仓库只发布规范、schema、技能包与模板。附录 D 给出写入与导出的推荐做法。

## 状态

**1.0.0 正式版**：规则集冻结，`1.x` 主版本兼容；规则变更进入新主版本。中英正文均已提供。

## 许可

文本 CC BY 4.0；代码与技能包 MIT。见 [`LICENSE`](LICENSE)。

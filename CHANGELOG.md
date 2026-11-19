# 变更记录

## 1.0.0 — 2026-11-19

正式版。以 0.18 为基线冻结规则集。

- 规范：`SPEC.md` 1.0（中文）与 `SPEC.en.md` 1.0（English）
- 新增可选元数据键：`type`（fact/preference/decision/event）、`valid`（事实生效日）
- 新增：`schema/mss.schema.json`、`schema/report.schema.json`
- 新增：技能包 `skills/memory-store/`（可安装到 DSH）
- 新增：DSH 插件包 `dsh-plugin/dsh-personal-memory-store/`（`memory_init` / `memory_doctor`，已本地装测）
- 新增：附录 E（Mem0／Letta／Zep／Cognee／MemOS 对照）
- 许可：文本 CC BY 4.0；代码与技能 MIT
- 版本策略：`1.x` 主版本兼容；规则变更进入新主版本

## 0.1 – 0.18 — 2026-11-15

草案期，经十四轮外部审阅迭代：从三主体草案收敛为「只认证库本身」；命令收缩为 `init` + `doctor`；补 `mss.json`、报告 schema、退出码、正则方言、编码与类型边界。逐版差异见 `SPEC.md` 附录 G。

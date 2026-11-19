# 变更记录

## 分享版 — 2026-11-19

- 定位改为「个人记忆库 · 参考结构」：我们的做法，不是标准
- 中英结构图换成旧版骨架的脱敏版（四层 + 写入三关 + 读取三查）
- 移除工具（技能、插件、schema）；工具不随本仓库发布
- README 重写为参考结构入口

## 1.0.0 — 2026-11-19

正式版。以 0.18 为基线冻结规则集。

- 规范：`SPEC.md` 1.0（中文）与 `SPEC.en.md` 1.0（English）
- 新增可选元数据键：`type`（fact/preference/decision/event）、`valid`（事实生效日）
- 新增：`schema/mss.schema.json`、`schema/report.schema.json`
- 新增：技能包 `skills/memory-store/`（可安装到 DSH）
- 新增：DSH 插件包（独立仓库 [dsh-personal-memory-store](https://github.com/zyx0407/dsh-personal-memory-store)：`memory_init` / `memory_doctor`，已用 GitHub 地址实装验证）
- 新增：附录 E（Mem0／Letta／Zep／Cognee／MemOS 对照）
- 许可：文本 CC BY 4.0；代码与技能 MIT
- 版本策略：`1.x` 主版本兼容；规则变更进入新主版本

## 0.1 – 0.18 — 2026-11-15

草案期，经十四轮外部审阅迭代：从三主体草案收敛为「只认证库本身」；命令收缩为 `init` + `doctor`；补 `mss.json`、报告 schema、退出码、正则方言、编码与类型边界。逐版差异见 `SPEC.md` 附录 G。

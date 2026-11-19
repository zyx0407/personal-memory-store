# 与主流记忆系统的对照与导入

本文件是非规范性的落地建议。核心思路：**别的系统导出成事实，我们落成条目；别人的图/向量，我们只当派生层。**

## 概念对照

| 系统 | 它的模型 | 落到 MSS |
| --- | --- | --- |
| Mem0 | 事实级记忆＋metadata；`user_id`/`agent_id`/`run_id` 作用域；ADD/UPDATE/DELETE | 一条记忆＝一个条目；`type` 标 fact/preference；一个作用域一个库根；UPDATE 用新条目 + 旧条目 `superseded` |
| Letta / MemGPT | 可自编辑的核心记忆块＋recall/archival | 核心块＝`MEMORY.md`；archival＝`memory/`；自编辑历史用 `status`/`superseded` 留痕 |
| Zep / Graphiti | 双时态边：`valid_at`/`invalid_at`/`created_at`＋episode | 条目日期＝`created_at`；`valid`＝`valid_at`；`superseded`≈`invalid_at`；`src` 指向 episode |
| Cognee | ECL 管道、图＋向量、dataset | dataset＝库根；图/向量＝`_state/` 派生层 |
| MemOS | MemCube：明文/激活/参数 | 明文＝库文件；激活/参数＝派生层 |

## 导入清单

1. **先定 scope**：每个 `user_id`/`agent_id`/项目一个库根，不要混在一个库里。
2. **导出成三元组**：`(date, text, meta)`；`text` 保留原句，不要摘要改写。
3. **生成 key**：稳定、可读，如 `mem0.<hash>` 或 `project.<topic>.<n>`；同 key 只留一条当前值。
4. **补 src**：指向导出文件（如 `memory/import-mem0.md:12`），保证 L3 可达。
5. **跑自检**：`python scripts/check.py <root>`；修到 L2 再声明。
6. **保留原始导出**：`memory/import-*.md` 里放原始行，条目引用它，便于回溯。

## 不要做

- 不要把向量/图当唯一真源；删了 `_state/` 必须还能读。
- 不要把 `user_id` 拼进正文冒充作用域；作用域用库根隔离。
- 不要为了「省条目」把多条事实挤进一行；一行一个 key。

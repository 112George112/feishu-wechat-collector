# 文章检索与分析详细文档

> **前置条件**：先阅读 [`../lark-shared/SKILL.md`](../../lark-shared/SKILL.md) 了解认证和全局参数。阅读 [`../lark-wiki/SKILL.md`](../../lark-wiki/SKILL.md) 和 [`../lark-doc/SKILL.md`](../../lark-doc/SKILL.md) 了解知识库和文档操作。

## 概述

本文档说明如何从飞书知识库中检索文章，并结合 AI Agent 进行智能总结和分析。

## 检索流程

### 方式一：使用 feishu-wiki-searcher.js 脚本

```bash
# 基本搜索
node scripts/feishu-wiki-searcher.js \
  --space-id "spacexxxx" \
  --query "大模型微调"

# 搜索并读取全文
node scripts/feishu-wiki-searcher.js \
  --space-id "spacexxxx" \
  --query "RAG 检索增强" \
  --full-text

# 限制结果数量
node scripts/feishu-wiki-searcher.js \
  --space-id "spacexxxx" \
  --query "产品设计" \
  --max-results 5

# 保存搜索结果到文件
node scripts/feishu-wiki-searcher.js \
  --space-id "spacexxxx" \
  --query "AI Agent" \
  --output search_results.json
```

### 方式二：直接使用 lark-cli 命令

```bash
# Step 1: 列出知识库节点
lark-cli wiki nodes list --space-id "spacexxxx" --format json

# Step 2: 根据标题筛选相关节点（由 AI Agent 处理）

# Step 3: 读取文档内容
lark-cli docs +fetch --doc "objxxxxx" --format pretty

# Step 4: 使用飞书文档搜索功能
lark-cli docs +search --query "关键词" --format json
```

## 搜索参数

| 参数 | 必填 | 默认值 | 说明 |
|------|------|--------|------|
| `--space-id <id>` | 是 | — | 知识库空间ID |
| `--parent-token <tok>` | 否 | — | 限定搜索的起始节点 |
| `--query <text>` | 是 | — | 搜索关键词（支持空格分隔多个关键词） |
| `--max-results <n>` | 否 | `10` | 最大返回结果数 |
| `--full-text` | 否 | — | 是否读取文章全文 |
| `--output <path>` | 否 | — | 输出结果到JSON文件 |

## 搜索结果格式

```json
{
  "query": "大模型微调",
  "spaceId": "spacexxxx",
  "totalNodes": 42,
  "matchedCount": 3,
  "results": [
    {
      "rank": 1,
      "title": "大模型微调实战指南",
      "score": 30,
      "nodeToken": "nodexxxx",
      "objToken": "objxxxxx",
      "depth": 1,
      "content": "# 大模型微调实战指南\n\n全文内容..."
    }
  ],
  "searchedAt": "2026-04-15T10:30:00.000Z"
}
```

## AI 分析工作流

当用户请求对文章进行分析时，AI Agent 应按以下流程操作：

### 1. 检索文章

```bash
# 搜索相关文章
node scripts/feishu-wiki-searcher.js \
  --space-id "spacexxxx" \
  --query "用户查询关键词" \
  --full-text \
  --max-results 3
```

### 2. AI 分析

Agent 直接对获取到的文章内容进行分析，支持以下分析类型：

| 分析类型 | 说明 | 输出格式 |
|----------|------|----------|
| **摘要总结** | 提取文章核心观点和关键信息 | Markdown 列表 |
| **观点提取** | 提取文章中的论点和论据 | 结构化表格 |
| **对比分析** | 对比多篇相关文章的异同 | 对比表格 |
| **趋势分析** | 分析多篇文章反映的趋势 | 分析报告 |
| **行动建议** | 基于文章内容给出建议 | 建议列表 |

### 3. 保存分析报告

```bash
# 创建分析报告文档
lark-cli docs +create \
  --title "【分析报告】大模型微调技术对比" \
  --markdown "$(cat report.md)"

# 可选：保存到知识库
lark-cli wiki nodes create \
  --space-id "spacexxxx" \
  --parent-node-token "reports_nodexxxx" \
  --title "【分析报告】大模型微调技术对比"
```

## 分析报告模板

Agent 生成分析报告时建议使用以下 Markdown 模板：

```markdown
# 【分析报告】{报告标题}

> 📅 生成时间：{日期}
> 📚 分析文章数：{数量}
> 🔍 分析类型：{摘要/对比/趋势}

## 文章概览

| # | 文章标题 | 作者 | 发布日期 |
|---|----------|------|----------|
| 1 | {标题} | {作者} | {日期} |

## 核心观点

### 观点一：{观点标题}
- **来源**：文章1、文章2
- **内容**：{详细说明}

### 观点二：{观点标题}
- **来源**：文章3
- **内容**：{详细说明}

## 对比分析

| 维度 | 文章1 | 文章2 | 文章3 |
|------|-------|-------|-------|
| {维度1} | {内容} | {内容} | {内容} |

## 总结与建议

1. {建议一}
2. {建议二}
3. {建议三}

---
*本报告由 AI Agent 基于 {数量} 篇文章自动生成*
```

## 使用场景示例

### 场景1：快速了解某主题
> 用户：最近保存了哪些关于 RAG 的文章？帮我总结一下
>
> Agent 操作：
> 1. 搜索知识库中标题包含 "RAG" 的文章
> 2. 读取匹配文章的全文
> 3. 生成综合摘要

### 场景2：多文章对比
> 用户：对比一下最近保存的3篇关于 Agent 框架的文章
>
> Agent 操作：
> 1. 搜索相关文章
> 2. 读取前3篇文章全文
> 3. 生成对比分析报告
> 4. 保存报告到飞书文档

### 场景3：定期汇总
> 用户：生成本周文章阅读汇总
>
> Agent 操作：
> 1. 列出本周新增的所有文章节点
> 2. 读取每篇文章的标题和摘要
> 3. 生成周报格式的汇总

## 参考

- [lark-wiki](../../lark-wiki/SKILL.md) — 知识库操作
- [lark-doc](../../lark-doc/SKILL.md) — 文档操作
- [知识库保存流程](wiki-save-workflow.md) — 文章保存
- [文章提取器](wechat-article-extractor.md) — 文章提取

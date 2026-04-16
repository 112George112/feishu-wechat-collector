---
name: lark-wechat-collector
version: 1.0.0
description: "微信公众号文章智能采集与知识库管理。当用户需要收藏微信公众号文章、将微信文章保存到飞书知识库、从知识库检索文章并生成总结分析时使用。"
metadata:
  requires:
    bins: ["lark-cli", "node"]
  cliHelp: "lark-cli wiki --help"
---
# 微信公众号文章采集器 (v1.0.0)

**CRITICAL — 开始前 MUST 先用 Read 工具读取 [`../lark-shared/SKILL.md`](../lark-shared/SKILL.md)，其中包含认证、权限处理。**

然后阅读以下 Skill 了解相关操作：
- [`../lark-wiki/SKILL.md`](../lark-wiki/SKILL.md) — 知识库空间和节点管理
- [`../lark-doc/SKILL.md`](../lark-doc/SKILL.md) — 文档创建、读取、更新
- [`../lark-drive/SKILL.md`](../lark-drive/SKILL.md) — 文件上传和管理
- [`../lark-im/SKILL.md`](../lark-im/SKILL.md) — 消息发送和回复

## 概述

本 Skill 将微信公众号文章的完整生命周期管理集成到飞书工作流中：

1. **采集** — 用户发送微信公众号链接，自动提取文章内容并截图
2. **存储** — 将文章内容和截图保存到飞书知识库，自动分类打标签
3. **检索** — 通过自然语言对话检索知识库中的相关文章
4. **分析** — 对文章进行智能总结、观点提取和对比分析

## 核心工作流

### 工作流一：保存微信文章到知识库

当用户发送微信公众号文章链接时，按以下步骤执行：

```bash
# Step 1: 提取微信文章内容和截图
node scripts/wechat-article-extractor.js "<微信文章URL>" --output /tmp/wechat-article

# 输出文件：
#   /tmp/wechat-article/article.json   — 结构化文章数据（标题、作者、正文Markdown、图片列表）
#   /tmp/wechat-article/screenshot.png  — 完整页面截图

# Step 2: 查询目标知识库空间（获取 space_id）
lark-cli wiki spaces list --format json

# Step 3: 使用一键保存脚本（推荐）
# 该脚本会自动完成：创建节点 → 下载图片 → 写入正文 → 上传图片 → 验证
node scripts/feishu-wiki-saver.js \
  --space-id "<space_id>" \
  --article "/tmp/wechat-article/article.json"

# 一键保存脚本内部流程：
#   3a. 创建知识库文档节点（wiki nodes create --params + --data）
#   3b. 下载微信图片到本地（绕过防盗链，带 Referer 头）
#   3c. 写入文章正文（docs +update --mode overwrite，不含图片链接）
#   3d. 逐张上传图片到飞书文档（docs +media-insert）
#   3e. 验证保存结果（检查图片数量和文档字数）

# Step 4: 回复用户保存成功
lark-cli im +messages-reply --chat-id "<chat_id>" --message-id "<msg_id>" \
  --text "✅ 文章已保存到知识库：\n标题：{标题}\n图片：{N}张\n知识库链接：{wiki_url}"
```

**重要：微信图片处理**
- 微信图片有防盗链，直接写入 Markdown 链接会被飞书忽略
- 必须先下载图片到本地（带 `Referer: https://mp.weixin.qq.com/` 请求头）
- 再通过 `docs +media-insert --file <本地路径>` 上传到飞书文档
- `+media-insert` 要求文件路径为相对路径，需在文件所在目录执行命令

### 工作流二：检索知识库文章

当用户请求检索相关文章时：

```bash
# Step 1: 列出知识库中的子节点
lark-cli wiki nodes list --space-id "<space_id>" --parent-node-token "<node_token>" --format json

# Step 2: 根据用户查询关键词，筛选相关文章标题
# （AI Agent 根据返回的节点列表进行语义匹配）

# Step 3: 获取匹配文章的内容
lark-cli docs +fetch --doc "<obj_token>" --format pretty

# Step 4: AI Agent 对文章内容进行分析总结
# （直接由 Agent 处理，无需额外 CLI 命令）
```

### 工作流三：生成文章分析报告

当用户要求对文章进行总结或分析时：

```bash
# Step 1: 检索并获取文章内容（同工作流二）

# Step 2: AI Agent 生成分析报告（Markdown格式）

# Step 3: 将报告保存为飞书文档
lark-cli docs +create --title "<报告标题>" --markdown "<报告内容Markdown>"

# Step 4: 可选：将报告也保存到知识库
lark-cli wiki nodes create --space-id "<space_id>" --parent-node-token "<node_token>" --title "<报告标题>"
```

## 脚本说明

### wechat-article-extractor.js

微信公众号文章提取和截图工具。

```bash
# 基本用法
node scripts/wechat-article-extractor.js "<URL>" --output <输出目录>

# 指定截图宽度（默认 1280px）
node scripts/wechat-article-extractor.js "<URL>" --output <输出目录> --width 375

# 仅提取内容不截图
node scripts/wechat-article-extractor.js "<URL>" --output <输出目录> --no-screenshot

# 仅截图不提取内容
node scripts/wechat-article-extractor.js "<URL>" --output <输出目录> --content-only false
```

**输出文件**：
| 文件 | 说明 |
|------|------|
| `article.json` | 结构化文章数据（标题、作者、发布时间、正文Markdown、图片URL列表、标签） |
| `screenshot.png` | 完整页面长图截图 |
| `metadata.json` | 提取元信息（提取时间、URL、字数统计等） |

## 权限表

| 操作 | 所需 scope |
|------|-----------|
| 查询知识库空间 | `wiki:space:read` |
| 创建知识库节点 | `wiki:node:create` |
| 读取知识库节点 | `wiki:node:read` |
| 创建/更新文档 | `docx:document:create`, `docx:document:edit` |
| 上传文件到云空间 | `drive:drive:upload` |
| 发送消息 | `im:message:send_as_bot` |

## 认证配置

```bash
# 初始化配置（首次使用）
lark-cli config init --new

# 登录并授权所需权限
lark-cli auth login --recommend

# 验证权限状态
lark-cli auth status
```

## 使用场景示例

### 场景1：用户在飞书群中发送微信文章链接
> 用户：https://mp.weixin.qq.com/s/xxxxx
>
> Agent 执行：提取内容 → 截图 → 保存到知识库 → 回复确认

### 场景2：用户要求检索相关文章
> 用户：帮我找关于"大模型微调"的文章
>
> Agent 执行：搜索知识库 → 匹配文章 → 返回列表

### 场景3：用户要求文章总结
> 用户：总结一下最近保存的那篇关于 RAG 的文章
>
> Agent 执行：检索文章 → 读取内容 → AI总结 → 输出/保存报告

## 注意事项

1. **微信文章反爬**：部分公众号文章可能有访问限制，提取脚本已内置等待和重试机制
2. **截图质量**：长文章截图可能较大，建议设置合理的 `--width` 参数
3. **知识库结构**：建议在知识库中预先创建好分类节点（如"技术"、"产品"、"行业"等）
4. **图片处理**：微信文章中的图片使用防盗链，提取脚本会自动下载并转为 base64 内嵌

## 参考

- [文章提取脚本详细文档](references/wechat-article-extractor.md)
- [知识库保存流程](references/wiki-save-workflow.md)
- [文章检索与分析](references/article-search-analysis.md)
- [lark-wiki](../lark-wiki/SKILL.md) — 知识库操作
- [lark-doc](../lark-doc/SKILL.md) — 文档操作
- [lark-drive](../lark-drive/SKILL.md) — 文件操作
- [lark-im](../lark-im/SKILL.md) — 消息操作
- [lark-shared](../lark-shared/SKILL.md) — 认证和全局参数

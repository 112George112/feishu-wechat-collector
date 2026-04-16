# 知识库保存流程详细文档

> **前置条件**：先阅读 [`../lark-shared/SKILL.md`](../../lark-shared/SKILL.md) 了解认证和全局参数。阅读 [`../lark-wiki/SKILL.md`](../../lark-wiki/SKILL.md) 了解知识库操作。

## 概述

本文档详细说明将微信文章保存到飞书知识库的完整流程，包括节点创建、文档写入和截图上传。

## 完整流程

### Step 1: 查询知识库空间

```bash
# 列出所有可用的知识库空间
lark-cli wiki spaces list --format json

# 输出示例：
# {
#   "items": [
#     {
#       "space_id": "spacexxxx",
#       "name": "文章收藏夹"
#     }
#   ]
# }
```

### Step 2: 查看知识库节点结构

```bash
# 列出知识库根节点
lark-cli wiki nodes list --space-id "spacexxxx" --format json

# 列出指定节点下的子节点
lark-cli wiki nodes list --space-id "spacexxxx" --parent-node-token "nodexxxx" --format json
```

### Step 3: 创建知识库文档节点

```bash
# 创建新的文档节点
lark-cli wiki nodes create \
  --space-id "spacexxxx" \
  --parent-node-token "parent_nodexxxx" \
  --title "文章标题" \
  --format json

# 输出示例：
# {
#   "node_token": "nodexxxx",
#   "obj_token": "objxxxxx",
#   "obj_type": "docx"
# }
```

**重要**：记录返回的 `node_token` 和 `obj_token`，后续步骤需要使用。

### Step 4: 写入文档内容

```bash
# 方式一：直接传入 Markdown 内容
lark-cli docs +update --doc "objxxxxx" --markdown "# 标题\n\n正文内容"

# 方式二：从文件读取 Markdown 内容
lark-cli docs +update --doc "objxxxxx" --markdown-file "./article.md"

# 方式三：使用 API 命令（更精细的控制）
lark-cli schema docs.document_content.create  # 先查看参数结构
lark-cli docs document_content create --doc-token "objxxxxx" --data '{"content":"..."}'
```

### Step 5: 上传截图到云空间

```bash
# 查看云空间文件夹列表
lark-cli drive folders list --format json

# 上传文件到指定文件夹
lark-cli drive files upload \
  --file-path "/path/to/screenshot.png" \
  --folder-token "fldxxxxx" \
  --file-name "文章标题_截图.png" \
  --format json

# 输出示例：
# {
#   "file_token": "filexxxxx"
# }
```

### Step 6: 在文档中插入截图

```bash
# 将上传的图片插入到文档中
lark-cli docs +media-insert \
  --doc "objxxxxx" \
  --file "filexxxxx" \
  --type image \
  --format json
```

## 使用 feishu-wiki-saver.js 一键保存

上述步骤已封装为 `feishu-wiki-saver.js` 脚本：

```bash
# 基本用法
node scripts/feishu-wiki-saver.js \
  --space-id "spacexxxx" \
  --parent-token "parent_nodexxxx" \
  --article "/tmp/article/article.json"

# 带截图上传
node scripts/feishu-wiki-saver.js \
  --space-id "spacexxxx" \
  --parent-token "parent_nodexxxx" \
  --article "/tmp/article/article.json" \
  --screenshot "/tmp/article/screenshot.png" \
  --folder-token "fldxxxxx"

# 预览模式（不实际执行）
node scripts/feishu-wiki-saver.js \
  --space-id "spacexxxx" \
  --parent-token "parent_nodexxxx" \
  --article "/tmp/article/article.json" \
  --dry-run
```

## 推荐的知识库目录结构

```
📚 文章收藏夹（知识库空间）
├── 📂 技术
│   ├── 📂 AI/ML
│   ├── 📂 前端开发
│   └── 📂 后端架构
├── 📂 产品
│   ├── 📂 产品设计
│   └── 📂 用户研究
├── 📂 行业动态
│   ├── 📂 科技资讯
│   └── 📂 市场分析
└── 📂 读书笔记
```

建议预先创建好分类节点，保存文章时选择对应的分类目录。

## 权限要求

| 操作 | 所需 scope |
|------|-----------|
| 查看知识库空间 | `wiki:space:read` |
| 创建知识库节点 | `wiki:node:create` |
| 更新文档内容 | `docx:document:edit` |
| 上传文件 | `drive:drive:upload` |
| 插入素材 | `docx:document:edit` |

```bash
# 一键授权所有必要权限
lark-cli auth login --recommend
```

## 参考

- [lark-wiki](../../lark-wiki/SKILL.md) — 知识库操作
- [lark-doc](../../lark-doc/SKILL.md) — 文档操作
- [lark-drive](../../lark-drive/SKILL.md) — 文件操作
- [文章提取器](wechat-article-extractor.md) — 微信文章提取

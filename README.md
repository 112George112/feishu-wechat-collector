# 📰 lark-wechat-collector

**基于飞书 CLI 的微信公众号文章智能采集 & 知识库管理 Skill**

> 一句话收藏微信文章：自动提取内容、下载图片、生成截图，按原文图文顺序保存到飞书知识库。支持自然语言检索和 AI 总结分析。

[English](README_EN.md)

## 😩 它解决什么问题

看到一篇好的公众号文章，想存下来？

- **手动复制粘贴** → 排版全乱了，图片一张张保存太麻烦
- **微信收藏** → 找不到、没法搜索、没法和团队共享
- **发到群里** → 过几天就淹没了，再也搜不到

所以我做了 lark-wechat-collector：**发个链接，文章内容 + 图片 + 截图全自动保存到飞书知识库，图文顺序完美还原，还能随时搜索和 AI 总结。**

## 🎬 Demo

```
用户: 帮我收藏这篇微信文章：https://mp.weixin.qq.com/s/xxxxx

Agent: ✅ 文章已保存到知识库
       标题: 东方乐城｜20-01地块顺利开工
       字数: 826 字 | 图片: 5 张（全部按原文顺序还原）
       知识库: 微信文章收集 > 东方乐城｜20-01地块顺利开工
```

## ⏱️ 效率对比

|  | 手动收藏 | lark-wechat-collector |
|---|---|---|
| **文章保存** | 复制文字 + 逐张保存图片，5-10 min | 发个链接，30 秒 |
| **图片处理** | 右键保存、重命名、上传，容易漏 | 自动下载 + 上传，防盗链绕过 |
| **排版还原** | 粘贴后手动调格式 | 图文按原文顺序自动排列 |
| **后续查找** | 翻聊天记录或微信收藏 | 知识库内搜索 + AI 语义检索 |
| **内容分析** | 重新读一遍再写总结 | AI 一键总结、对比分析 |

## 💬 一句话怎么用

```
帮我收藏这篇微信文章：https://mp.weixin.qq.com/s/xxxxx
```

AI Agent 自动完成：

1. 📥 **内容提取** — 抓取文章标题、作者、正文、图片列表
2. 📸 **页面截图** — 生成完整长图截图（可选）
3. 💾 **图片下载** — 带防盗链绕过，逐张下载微信图片到本地
4. 📝 **图文还原** — 按原文顺序交替写入文字段和图片到飞书文档
5. 📚 **知识库归档** — 创建知识库节点，文档自动归类
6. ✅ **保存验证** — 自动检查图片数量和文档完整性

## 🏗️ 架构

```
用户发送微信文章链接
        │
        ▼
┌─────────────────────┐
│  Step 1: 内容提取     │  curl + cheerio
│  标题/作者/正文/图片    │  HTML → Markdown
└─────────┬───────────┘
          ▼
┌─────────────────────┐
│  Step 2: 图片下载     │  HTTPS + Referer 绕过防盗链
│  逐张下载到本地         │  支持 png/jpg/gif
└─────────┬───────────┘
          ▼
┌─────────────────────┐
│  Step 3: 图文还原     │  lark-cli docs +update (append)
│  按原文顺序交替写入     │  lark-cli docs +media-insert
│  文字段 → 图片 → 文字  │  每张图片单独上传
└─────────┬───────────┘
          ▼
┌─────────────────────┐
│  Step 4: 知识库归档   │  lark-cli wiki nodes create
│  创建节点 + 验证      │  自动检查图片数量匹配
└─────────────────────┘
```

## 🆕 技术亮点

### 微信图片防盗链绕过

微信图片使用 `Referer` 校验，直接写入飞书文档会被忽略。解决方案：

```bash
# 带微信 Referer 头下载图片
curl -H "Referer: https://mp.weixin.qq.com/" -o img.png "https://mmbiz.qpic.cn/..."

# 上传到飞书文档
lark-cli docs +media-insert --doc <token> --file img.png --type image
```

### 图文顺序完美还原

将 Markdown 按 `![...](...)` 拆分为「文字段」和「图片」交替片段，按原文顺序依次写入：

```
文档头部 (overwrite)
  → 文字段1 (append) → 图片1 (media-insert)
  → 文字段2 (append) → 图片2 (media-insert)
  → 文字段3 (append) → 图片3 (media-insert)
```

### HTML 深度递归解析

微信文章 DOM 结构复杂（图片嵌套在 `<a>`、`<p><span>`、多层 `<section>` 中），转换器对所有容器标签递归处理，确保图片零丢失。

### 保存后自动验证

```bash
# 验证图片数量是否匹配
# 验证文档字数是否正常
# 输出验证报告
📊 验证结果:
   📝 文档字数: 381
   🖼️  图片数量: 5 (预期: 5)
   ✅ 图片数量匹配
   ✅ 文档内容正常
   🎉 验证通过！
```

## ⚡ 有什么不同

| 维度 | 手动保存 | 浏览器插件 | lark-wechat-collector |
|---|---|---|---|
| 🎯 **保存方式** | 复制粘贴 | 浏览器内操作 | 发个链接，AI 全自动 |
| 🖼️ **图片处理** | 逐张右键保存 | 截图或保存 | 自动下载 + 上传，防盗链绕过 |
| 📐 **排版还原** | 需手动调整 | 依赖插件 | 图文按原文顺序完美还原 |
| 📚 **知识管理** | 散落各处 | 本地收藏 | 飞书知识库，团队可共享 |
| 🔍 **检索能力** | 靠记忆 | 有限搜索 | AI 语义检索 + 总结分析 |
| 🤖 **AI 集成** | 无 | 无 | AI Agent 原生支持 |

## 📦 安装

### 一键安装（推荐）

```bash
curl -fsSL https://raw.githubusercontent.com/feishu-wechat-collector/main/setup.sh | bash
```

或克隆后本地运行：

```bash
git clone https://github.com/feishu-wechat-collector.git && bash lark-wechat-collector/setup.sh
```

### 手动安装

<details>
<summary>展开手动安装步骤</summary>

#### 前置要求

- Node.js >= 18
- [lark-cli](https://github.com/larksuite/cli) 已安装

#### 安装步骤

```bash
# 1. 安装 lark-cli（如尚未安装）
npm install -g @larksuite/cli

# 2. 安装官方 Skills（包含 lark-shared 等基础依赖，必须先装）
npx skills add https://github.com/larksuite/cli -y -g

# 3. 安装 lark-wechat-collector
npx skills add https://github.com/feishu-wechat-collector -y -g

# 4. 安装脚本依赖
cd lark-wechat-collector && npm install

# 5. 配置并登录
lark-cli config init --new
lark-cli auth login --recommend

# 6. 重启你的 AI Agent 工具（Trae / Cursor / Claude Code）
```

⚠️ 第 2 步必须先于第 3 步执行。`lark-wechat-collector` 依赖官方 `lark-shared` Skill。

</details>

## 🚀 使用示例

### 收藏文章

```
帮我收藏这篇微信文章：https://mp.weixin.qq.com/s/xxxxx
```

### 收藏并指定分类

```
把这篇文章保存到知识库的"技术文章"分类下：https://mp.weixin.qq.com/s/xxxxx
```

### 搜索文章

```
在知识库中搜索关于"大模型微调"的文章
```

### 总结分析

```
总结一下最近保存的那篇关于 RAG 的文章
```

### 多文章对比

```
对比最近3篇关于 Agent 框架的文章，生成分析报告
```

### 定期汇总

```
生成本周收藏的文章汇总
```

## 📋 示例输出

完整的保存日志示例：

```
📚 飞书知识库文章保存工具 v2
📄 标题: 东方乐城｜20-01地块顺利开工
📂 空间: 微信文章收集
🖼️  图片: 5 张

Step 1: 创建知识库文档节点 ✅
Step 2: 下载微信图片 (5/5 成功) ✅
Step 3: 按原文顺序写入内容
  📊 内容拆分: 3 段文字, 5 张图片
  文字段1 → 图片1 → 文字段2 → 图片2 → 文字段3 → 图片3 → 图片4 → 图片5 ✅
Step 5: 验证保存结果
  📝 文档字数: 381
  🖼️  图片数量: 5 (预期: 5)
  🎉 验证通过！
```

## ⚙️ 配置说明

首次使用需完成 `lark-cli` 配置与授权（见安装步骤）。

### 所需飞书权限

| Scope | 说明 | 必要性 |
|-------|------|--------|
| `wiki:space:read` | 查看知识库空间 | 必须 |
| `wiki:node:create` | 创建知识库节点 | 必须 |
| `wiki:node:read` | 读取知识库节点 | 必须 |
| `docx:document:create` | 创建文档 | 必须 |
| `docx:document:edit` | 编辑文档 | 必须 |
| `drive:drive:upload` | 上传文件 | 推荐 |
| `im:message:send_as_bot` | 发送消息通知 | 可选 |

```bash
# 一键授权所有必要权限
lark-cli auth login --recommend
```

## 📁 项目结构

```
lark-wechat-collector/
├── skills/
│   └── lark-wechat-collector/
│       ├── SKILL.md                              # Skill 主文档（AI Agent 入口）
│       └── references/                           # 详细参考文档
│           ├── wechat-article-extractor.md       # 文章提取器文档
│           ├── wiki-save-workflow.md             # 知识库保存流程
│           └── article-search-analysis.md        # 文章检索与分析
├── scripts/
│   ├── wechat-article-extractor.js               # 微信文章提取 + 截图（Playwright）
│   ├── feishu-wiki-saver.js                      # 保存到飞书知识库（含图片下载+验证）
│   └── feishu-wiki-searcher.js                   # 知识库文章检索
├── examples/
│   └── sample-output.md                          # 示例输出
├── docs/
│   └── dev-story.md                              # 开发踩坑记录
├── setup.sh                                      # 一键安装脚本
├── package.json
├── LICENSE
├── README.md
└── README_EN.md
```

## ✅ 已验证的能力

### 完整 E2E 验证（真实文章测试）

- ✅ 微信文章内容提取（标题、作者、正文 Markdown）
- ✅ 图片完整提取（嵌套在 `<a>`、`<p><span>`、多层 `<section>` 中的图片）
- ✅ 微信图片防盗链绕过（Referer 头 + 本地下载）
- ✅ 图片格式自动识别（png/jpg/gif）
- ✅ 图文按原文顺序还原（文字段与图片交替写入）
- ✅ 飞书知识库节点创建（`wiki nodes create --params + --data`）
- ✅ 飞书文档内容写入（`docs +update --mode append`）
- ✅ 飞书图片上传插入（`docs +media-insert`）
- ✅ 保存后自动验证（图片数量 + 文档字数检查）
- ✅ 知识库文章检索（`wiki nodes list` + 关键词匹配）

### 测试覆盖的文章类型

| 文章类型 | 图片数 | 结果 |
|----------|--------|------|
| 图文资讯（简单排版） | 5 张 | ✅ 全部通过 |
| 营销推广（复杂嵌套） | 13 张（含 GIF） | ✅ 全部通过 |
| 技术文章（代码块+表格） | 待测试 | — |

## 🛠️ 技术栈

| 组件 | 技术 | 说明 |
|------|------|------|
| 文章提取 | [cheerio](https://github.com/cheeriojs/cheerio) | HTML 解析，深度递归转换 |
| 页面截图 | [Playwright](https://playwright.dev/) | 浏览器自动化截图（可选） |
| 飞书操作 | [lark-cli](https://github.com/larksuite/cli) | 知识库/文档/文件操作 |
| 图片下载 | Node.js https | Referer 绕过防盗链 |
| AI 分析 | AI Agent | 自然语言检索和总结 |

## 📖 开发故事

想知道微信图片防盗链怎么绕过的？图文顺序还原踩了哪些坑？HTML 深度递归解析是怎么一步步演进的？

👉 [开发踩坑记录](docs/dev-story.md)

## 🤝 贡献

欢迎提交 Issue 和 Pull Request！

## ⭐ 支持项目

如果 lark-wechat-collector 对你有帮助，请给个 Star ⭐ 让更多人看到！

## 📄 许可证

[MIT](LICENSE)

为 [飞书 CLI 创作者大赛 2026](https://bytedance.larkoffice.com/docx/HWgKdWfeSoDw36xu7EYctBrUnsg) 而作，基于 [lark-cli](https://github.com/larksuite/cli) 构建。

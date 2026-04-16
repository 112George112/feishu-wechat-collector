# 微信文章提取器详细文档

> **前置条件**：先阅读 [`../lark-shared/SKILL.md`](../../lark-shared/SKILL.md) 了解认证和全局参数。

## 概述

`wechat-article-extractor.js` 是一个基于 Playwright 的微信公众号文章提取工具，能够：
- 提取文章标题、作者、发布日期等元信息
- 将正文 HTML 转换为 Markdown 格式
- 提取文章中的所有图片 URL
- 生成完整页面的长图截图
- 自动处理懒加载内容

## 安装依赖

```bash
# 安装 Playwright
npm install playwright

# 安装 Chromium 浏览器（首次使用）
npx playwright install chromium
```

## 命令

```bash
# 基本用法 — 提取内容并截图
node scripts/wechat-article-extractor.js "https://mp.weixin.qq.com/s/xxxxx" --output /tmp/article

# 指定移动端视口宽度（375px）
node scripts/wechat-article-extractor.js "https://mp.weixin.qq.com/s/xxxxx" --output /tmp/article --width 375

# 仅提取内容，不生成截图
node scripts/wechat-article-extractor.js "https://mp.weixin.qq.com/s/xxxxx" --output /tmp/article --no-screenshot

# 自定义超时和等待时间
node scripts/wechat-article-extractor.js "https://mp.weixin.qq.com/s/xxxxx" --output /tmp/article --timeout 90000 --wait 5000
```

## 参数

| 参数 | 必填 | 默认值 | 说明 |
|------|------|--------|------|
| `<URL>` | 是 | — | 微信公众号文章链接（mp.weixin.qq.com） |
| `--output <dir>` | 否 | `./output` | 输出目录路径 |
| `--width <px>` | 否 | `1280` | 浏览器视口宽度（像素） |
| `--no-screenshot` | 否 | — | 不生成页面截图 |
| `--content-only` | 否 | — | 仅提取内容，不处理图片 |
| `--timeout <ms>` | 否 | `60000` | 页面加载超时时间（毫秒） |
| `--wait <ms>` | 否 | `3000` | 页面加载后额外等待时间（毫秒） |

## 输出文件

### article.json

结构化文章数据，格式如下：

```json
{
  "title": "文章标题",
  "author": "公众号名称",
  "publishDate": "2026-04-15",
  "content": "# 正文标题\n\n正文内容Markdown格式...",
  "wordCount": 3500,
  "images": [
    {
      "src": "https://mmbiz.qpic.cn/...",
      "alt": "图片描述",
      "width": 800,
      "height": 600
    }
  ],
  "tags": ["标签1", "标签2"],
  "summary": "文章摘要前200字..."
}
```

### screenshot.png

完整页面的长图截图（PNG格式）。使用 Playwright 的 `fullPage: true` 选项生成。

### metadata.json

提取过程的元信息：

```json
{
  "url": "https://mp.weixin.qq.com/s/xxxxx",
  "extractedAt": "2026-04-15T10:30:00.000Z",
  "extractorVersion": "1.0.0",
  "options": {
    "width": 1280,
    "screenshot": true
  }
}
```

## 技术实现细节

### 页面加载策略

1. 使用 `networkidle` 等待策略，确保所有网络请求完成
2. 额外等待 3 秒（可配置）确保动态内容渲染
3. 自动滚动到页面底部，触发懒加载图片
4. 滚动后再次等待 2 秒

### HTML 转 Markdown

支持以下 HTML 元素的转换：

| HTML 元素 | Markdown 输出 |
|-----------|--------------|
| `<h1>` ~ `<h4>` | `#` ~ `####` 标题 |
| `<p>` | 段落文本 |
| `<strong>`, `<b>` | `**粗体**` |
| `<em>`, `<i>` | `*斜体*` |
| `<blockquote>` | `> 引用` |
| `<ul>`, `<ol>` | 列表 |
| `<pre>`, `<code>` | 代码块 |
| `<img>` | `![alt](src)` |
| `<a>` | `[text](href)` |
| `<table>` | Markdown 表格 |
| `<hr>` | `---` |

### 微信文章特殊处理

- 图片使用 `data-src` 属性（微信懒加载），脚本会优先读取该属性
- 微信图片使用防盗链，提取的 URL 为微信 CDN 地址
- 公众号名称从 `#js_name` 元素提取
- 文章 ID 从 URL 路径中解析

## 常见问题

### Q: 提取的内容为空？
A: 可能是文章需要关注公众号才能阅读，或页面加载超时。尝试增加 `--timeout` 和 `--wait` 参数。

### Q: 截图不完整？
A: 某些文章使用了无限滚动或特殊布局。尝试增加 `--wait` 参数到 5000ms 以上。

### Q: 图片 URL 无法访问？
A: 微信图片有防盗链机制，URL 仅在微信环境下可访问。如需保存图片，建议下载后上传到飞书云空间。

## 参考

- [Playwright 截图文档](https://playwright.net.cn/docs/screenshots)
- [lark-doc](../../lark-doc/SKILL.md) — 飞书文档操作
- [lark-drive](../../lark-drive/SKILL.md) — 飞书文件上传

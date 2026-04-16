# 📰 lark-wechat-collector

**WeChat Article Collector & Feishu Wiki Manager — AI Agent Skill for Feishu CLI**

> Save WeChat articles to Feishu Wiki with one link: auto-extract content, download images (bypassing anti-hotlinking), and restore original text-image layout.

[中文](README.md)

## 😩 The Problem

Found a great WeChat article and want to save it?

- **Copy-paste** → Formatting is messed up, saving images one by one is tedious
- **WeChat Favorites** → Hard to find, can't search, can't share with team
- **Send to chat** → Buried in a few days, impossible to search

So I built lark-wechat-collector: **Send a link, and the article content + images + screenshot are automatically saved to Feishu Wiki with perfect layout restoration. Supports natural language search and AI summarization.**

## ⏱️ Efficiency Comparison

|  | Manual | lark-wechat-collector |
|---|---|---|
| **Save article** | Copy text + save images one by one, 5-10 min | Send a link, 30 seconds |
| **Image handling** | Right-click save, rename, upload, easy to miss | Auto download + upload, anti-hotlinking bypass |
| **Layout restore** | Manual formatting after paste | Text-image order auto-restored |
| **Search later** | Scroll through chat history | Wiki search + AI semantic search |
| **Content analysis** | Re-read and write summary | AI one-click summary, comparison |

## 💬 One-Line Usage

```
Save this WeChat article: https://mp.weixin.qq.com/s/xxxxx
```

AI Agent automatically:

1. 📥 **Extract content** — Title, author, body text, image list
2. 📸 **Screenshot** — Full-page screenshot (optional)
3. 💾 **Download images** — Bypass anti-hotlinking, download to local
4. 📝 **Restore layout** — Write text and images in original order to Feishu doc
5. 📚 **Archive to Wiki** — Create Wiki node, auto-categorize
6. ✅ **Verify** — Auto-check image count and document integrity

## 🏗️ Architecture

```
User sends WeChat article URL
        │
        ▼
┌─────────────────────┐
│  Step 1: Extract     │  curl + cheerio
│  Title/Author/Text   │  HTML → Markdown
└─────────┬───────────┘
          ▼
┌─────────────────────┐
│  Step 2: Download    │  HTTPS + Referer bypass
│  Images to local     │  Supports png/jpg/gif
└─────────┬───────────┘
          ▼
┌─────────────────────┐
│  Step 3: Restore     │  lark-cli docs +update (append)
│  Text-image order    │  lark-cli docs +media-insert
└─────────┬───────────┘
          ▼
┌─────────────────────┐
│  Step 4: Archive     │  lark-cli wiki nodes create
│  Verify & validate   │  Auto-check image count
└─────────────────────┘
```

## 🆕 Technical Highlights

### WeChat Image Anti-Hotlinking Bypass

WeChat images use `Referer` validation. Direct URLs in Feishu docs are ignored.

```bash
# Download with WeChat Referer header
curl -H "Referer: https://mp.weixin.qq.com/" -o img.png "https://mmbiz.qpic.cn/..."

# Upload to Feishu doc
lark-cli docs +media-insert --doc <token> --file img.png --type image
```

### Perfect Text-Image Layout Restoration

Split Markdown by `![...](...)` into alternating text/image segments, write in order:

```
Header (overwrite)
  → Text1 (append) → Image1 (media-insert)
  → Text2 (append) → Image2 (media-insert)
  → Text3 (append) → Image3 (media-insert)
```

### Deep Recursive HTML Parsing

WeChat articles have complex DOM (images nested in `<a>`, `<p><span>`, multi-level `<section>`). The converter recursively processes all container tags to ensure zero image loss.

### Post-Save Verification

```
📊 Verification:
   📝 Word count: 381
   🖼️  Images: 5 (expected: 5)
   ✅ Image count matched
   ✅ Document content OK
   🎉 Verification passed!
```

## 📦 Installation

### One-Click Install (Recommended)

```bash
curl -fsSL https://raw.githubusercontent.com/feishu-wechat-collector/main/setup.sh | bash
```

### Manual Install

```bash
# 1. Install lark-cli
npm install -g @larksuite/cli

# 2. Install official Skills (required dependency)
npx skills add https://github.com/larksuite/cli -y -g

# 3. Install lark-wechat-collector
npx skills add https://github.com/feishu-wechat-collector -y -g

# 4. Install script dependencies
cd lark-wechat-collector && npm install

# 5. Configure and login
lark-cli config init --new
lark-cli auth login --recommend

# 6. Restart your AI Agent (Trae / Cursor / Claude Code)
```

## 🚀 Usage Examples

### Save an article
```
Save this WeChat article: https://mp.weixin.qq.com/s/xxxxx
```

### Save with category
```
Save this article to the "Tech Articles" category in Wiki: https://mp.weixin.qq.com/s/xxxxx
```

### Search articles
```
Search for articles about "LLM fine-tuning" in the Wiki
```

### Summarize
```
Summarize the article about RAG I saved recently
```

### Compare articles
```
Compare the last 3 articles about Agent frameworks and generate an analysis report
```

## ✅ Verified Capabilities

- ✅ WeChat article content extraction (title, author, Markdown body)
- ✅ Complete image extraction (nested in `<a>`, `<p><span>`, multi-level `<section>`)
- ✅ WeChat image anti-hotlinking bypass (Referer header + local download)
- ✅ Auto image format detection (png/jpg/gif)
- ✅ Text-image layout restoration (alternating text segments and images)
- ✅ Feishu Wiki node creation
- ✅ Feishu document content writing
- ✅ Feishu image upload and insertion
- ✅ Post-save verification (image count + word count check)
- ✅ Wiki article search

## 📄 License

[MIT](LICENSE)

Built for [Feishu CLI Creator Contest 2026](https://bytedance.larkoffice.com/docx/HWgKdWfeSoDw36xu7EYctBrUnsg), powered by [lark-cli](https://github.com/larksuite/cli).

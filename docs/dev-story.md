# 开发踩坑记录

## lark-wechat-collector 是怎么做出来的

### 踩坑 1：微信图片在飞书文档中全部丢失

**现象**：文章保存到飞书后，文字正常，但所有图片都不显示。

**原因**：微信图片使用 `Referer` 校验防盗链。直接将 `![](https://mmbiz.qpic.cn/...)` 写入飞书文档，飞书无法访问该 URL，图片被忽略。

**解决**：
1. 先用 Node.js `https` 模块下载图片到本地，请求头带 `Referer: https://mp.weixin.qq.com/`
2. 再用 `lark-cli docs +media-insert --file <本地路径>` 上传到飞书文档

```javascript
const req = https.get(url, {
  headers: { 'Referer': 'https://mp.weixin.qq.com/' }
}, (res) => { /* pipe to file */ });
```

### 踩坑 2：图片全部堆在文末，顺序乱了

**现象**：第一版实现是「先写全部文字 → 再追加所有图片」，导致图片全部在文末。

**原因**：`docs +media-insert` 只能追加到文档末尾，无法指定位置。

**解决**：将 Markdown 按 `![...](...)` 拆分为交替的「文字段」和「图片」片段，按原文顺序依次写入：

```
文档头部 (overwrite)
  → 文字段1 (append) → 图片1 (media-insert)
  → 文字段2 (append) → 图片2 (media-insert)
  → ...
```

### 踩坑 3：部分图片在提取时丢失

**现象**：5 张图片只提取到 3 张，另外 2 张消失了。

**原因**：HTML→Markdown 转换中，`<p>`、`<strong>`、`<a>` 等标签用了 `.text()` 取纯文本，会丢弃内嵌的 `<img>` 子元素。

**解决**：将所有容器标签改为递归调用 `htmlToMarkdown($el)`：

```javascript
// 之前（丢失图片）
case 'p': md += $el.text().trim() + '\n\n'; break;

// 之后（保留图片）
case 'p': md += htmlToMarkdown($el) + '\n\n'; break;
```

### 踩坑 4：`<a>` 标签内的图片丢失

**现象**：微信文章中有些图片被 `<a>` 标签包裹（点击跳转小程序），这些图片全部丢失。

**原因**：`<a>` 标签处理也用了 `.text()`。

**解决**：`<a>` 标签递归处理，如果内部只有图片则只保留图片不包裹链接：

```javascript
case 'a': {
  const inner = htmlToMarkdown($el).trim();
  if (/^!\[.*\]\(.*\)$/.test(inner)) {
    md += inner; // 只保留图片
  } else {
    md += '[' + inner + '](' + href + ')';
  }
}
```

### 踩坑 5：lark-cli 的 `@文件路径` 必须是相对路径

**现象**：`docs +update --markdown @/absolute/path/file.md` 报错 "invalid file path"。

**原因**：lark-cli 内部校验 `@` 后的路径必须是相对路径。

**解决**：在文件所在目录执行命令（`cd dir && lark-cli ...`），`@` 后只用文件名：

```javascript
const cmd = `cd "${outputDir}" && lark-cli docs +update --doc "${token}" --markdown @${fileName}`;
```

### 踩坑 6：`wiki nodes create` 参数格式

**现象**：`lark-cli wiki nodes create --space-id xxx --title xxx` 报错。

**原因**：`space_id` 是 query 参数（`--params`），`title`、`node_type`、`obj_type` 是 body 参数（`--data`）。

**解决**：
```bash
lark-cli wiki nodes create \
  --params '{"space_id":"xxx"}' \
  --data '{"node_type":"origin","obj_type":"docx","title":"文章标题"}'
```

### 踩坑 7：图片格式自动识别

**现象**：微信图片 URL 不带扩展名，无法判断是 png/jpg/gif。

**解决**：根据 HTTP 响应的 `Content-Type` 头自动判断：

```javascript
const ext = res.headers['content-type']?.includes('gif') ? '.gif' :
            res.headers['content-type']?.includes('png') ? '.png' : '.jpg';
```

### 踩坑 8：HTTP 重定向处理

**现象**：部分微信图片 URL 返回 302 重定向，直接下载失败。

**解决**：处理 3xx 重定向，递归跟随 `Location` 头：

```javascript
if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
  downloadFile(res.headers.location, destPath).then(resolve).catch(reject);
  return;
}
```

## 总结

| 踩坑 | 根因 | 解决方案 |
|------|------|----------|
| 图片丢失 | 微信防盗链 | Referer 头 + 本地下载 + 上传 |
| 图片顺序乱 | media-insert 只能追加 | 按原文顺序交替写入 |
| 图片提取不全 | .text() 丢弃子元素 | 递归 htmlToMarkdown |
| <a> 内图片丢失 | 同上 | 递归 + 图片检测 |
| 绝对路径报错 | lark-cli 校验 | cd 到目录 + 相对路径 |
| wiki create 参数 | params vs data 分离 | --params + --data |
| 图片格式未知 | URL 无扩展名 | Content-Type 判断 |
| 302 重定向 | 微信 CDN 策略 | 递归跟随 Location |

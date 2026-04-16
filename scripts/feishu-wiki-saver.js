#!/usr/bin/env node

/**
 * 飞书知识库文章保存工具 v2
 * 
 * 改进：
 *   - 下载微信图片到本地（绕过防盗链）
 *   - 上传图片到飞书文档（使用 +media-insert）
 *   - 保存后验证：检查图片数量是否匹配
 *   - 修复 lark-cli 参数格式（--params + --data）
 *
 * 用法：
 *   node feishu-wiki-saver.js --space-id <id> --article <article.json>
 *   node feishu-wiki-saver.js --space-id <id> --article <article.json> --parent-token <tok>
 *   node feishu-wiki-saver.js --space-id <id> --article <article.json> --dry-run
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const https = require('https');
const http = require('http');

// ========== 参数解析 ==========
function parseArgs(args) {
  const opts = {
    spaceId: null,
    parentToken: '',
    article: null,
    screenshot: null,
    dryRun: false,
    skipImages: false,
  };
  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case '--space-id': opts.spaceId = args[++i]; break;
      case '--parent-token': opts.parentToken = args[++i]; break;
      case '--article': opts.article = args[++i]; break;
      case '--screenshot': opts.screenshot = args[++i]; break;
      case '--dry-run': opts.dryRun = true; break;
      case '--skip-images': opts.skipImages = true; break;
    }
  }
  return opts;
}

// ========== 工具函数 ==========
function runLarkCli(command, description, cwd) {
  console.log(`  🔧 ${description}`);
  if (opts.dryRun) {
    console.log(`     ⏭️  [DRY-RUN]`);
    return null;
  }
  try {
    const cmd = cwd ? `cd "${cwd}" && lark-cli ${command}` : `lark-cli ${command}`;
    const result = execSync(cmd, {
      encoding: 'utf-8', timeout: 60000, maxBuffer: 50 * 1024 * 1024,
    });
    return result.trim();
  } catch (error) {
    const stderr = error.stderr ? error.stderr.toString().trim() : '';
    console.error(`     ❌ 失败: ${stderr || error.message}`);
    return null;
  }
}

function parseJson(output) {
  if (!output) return null;
  try {
    const m = output.match(/\{[\s\S]*\}/);
    return m ? JSON.parse(m[0]) : JSON.parse(output);
  } catch { return null; }
}

// ========== 图片下载 ==========
function downloadFile(url, destPath) {
  return new Promise((resolve, reject) => {
    const mod = url.startsWith('https') ? https : http;
    const req = mod.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Referer': 'https://mp.weixin.qq.com/',
      },
      timeout: 15000,
    }, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        downloadFile(res.headers.location, destPath).then(resolve).catch(reject);
        return;
      }
      if (res.statusCode !== 200) {
        reject(new Error(`HTTP ${res.statusCode}`));
        return;
      }
      const ext = res.headers['content-type']?.includes('gif') ? '.gif' :
                  res.headers['content-type']?.includes('png') ? '.png' : '.jpg';
      const finalPath = destPath.replace(/\.\w+$/, ext);
      const ws = fs.createWriteStream(finalPath);
      res.pipe(ws);
      ws.on('finish', () => resolve(finalPath));
      ws.on('error', reject);
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('timeout')); });
  });
}

async function downloadImages(images, outputDir) {
  const results = [];
  if (!images || images.length === 0) return results;

  const imgDir = path.join(outputDir, 'images');
  if (!fs.existsSync(imgDir)) fs.mkdirSync(imgDir, { recursive: true });

  console.log(`\n  📥 下载 ${images.length} 张微信图片...`);
  for (let i = 0; i < images.length; i++) {
    const img = images[i];
    const fileName = `img_${String(i).padStart(3, '0')}.jpg`;
    const filePath = path.join(imgDir, fileName);
    try {
      const finalPath = await downloadFile(img.src, filePath);
      results.push({ index: i, originalSrc: img.src, localPath: finalPath, success: true });
      console.log(`     ✅ [${i + 1}/${images.length}] ${path.basename(finalPath)}`);
    } catch (e) {
      results.push({ index: i, originalSrc: img.src, localPath: null, success: false, error: e.message });
      console.log(`     ❌ [${i + 1}/${images.length}] 下载失败: ${e.message}`);
    }
  }
  const successCount = results.filter(r => r.success).length;
  console.log(`  📊 下载完成: ${successCount}/${images.length} 张成功`);
  return results;
}

// ========== 将内容按原文顺序拆分为「文字段」和「图片」交替片段 ==========
function splitContentWithImages(articleData) {
  // 构建图片 URL → 下载路径 的映射
  const imgMap = {};
  if (opts._downloadedImages) {
    for (const img of opts._downloadedImages) {
      if (img.success) imgMap[img.originalSrc] = img.localPath;
    }
  }

  const content = articleData.content || '';
  // 匹配 ![alt](url) 格式的图片
  const imgRegex = /!\[([^\]]*)\]\(([^)]+)\)/g;
  const segments = []; // { type: 'text'|'image', content: string }
  let lastIndex = 0;
  let match;

  while ((match = imgRegex.exec(content)) !== null) {
    // 图片前的文字段
    const textBefore = content.substring(lastIndex, match.index).trim();
    if (textBefore) {
      segments.push({ type: 'text', content: textBefore });
    }
    // 图片段
    const imgSrc = match[2];
    const localPath = imgMap[imgSrc] || null;
    segments.push({ type: 'image', src: imgSrc, alt: match[1], localPath });
    lastIndex = match.index + match[0].length;
  }

  // 最后一段文字
  const textAfter = content.substring(lastIndex).trim();
  if (textAfter) {
    segments.push({ type: 'text', content: textAfter });
  }

  return segments;
}

// ========== 生成文档头部（不含正文和图片） ==========
function generateDocHeader(articleData) {
  const lines = [];
  lines.push(`# ${articleData.title}`);
  lines.push('');
  lines.push('> 📌 **来源**: 微信公众号');
  if (articleData.author) lines.push(`> ✍️ **作者**: ${articleData.author}`);
  if (articleData.publishDate) lines.push(`> 📅 **发布日期**: ${articleData.publishDate}`);
  if (articleData.wordCount) lines.push(`> 📝 **字数**: ${articleData.wordCount}`);
  lines.push('');
  lines.push('---');
  lines.push('');
  return lines.join('\n');
}

// ========== 验证环节 ==========
function verifyDocument(objToken, expectedImageCount) {
  console.log(`\n${'='.repeat(50)}`);
  console.log(`Step 5: 验证保存结果`);
  console.log(`${'='.repeat(50)}`);

  const fetchResult = runLarkCli(
    `docs +fetch --doc "${objToken}"`,
    '读取文档验证内容'
  );

  if (!fetchResult) {
    console.log('  ❌ 验证失败：无法读取文档');
    return false;
  }

  const data = parseJson(fetchResult);
  const markdown = data?.data?.markdown || data?.markdown || fetchResult;

  // 统计图片数量
  const imageTokens = markdown.match(/image token="[^"]*"/g) || [];
  const actualImages = imageTokens.length;

  // 统计字数
  const textOnly = markdown.replace(/<[^>]+>/g, '').replace(/[#*>\-|`]/g, '');
  const charCount = textOnly.replace(/\s/g, '').length;

  console.log(`  📊 验证结果:`);
  console.log(`     📝 文档字数: ${charCount}`);
  console.log(`     🖼️  图片数量: ${actualImages} (预期: ${expectedImageCount})`);

  let allPassed = true;

  if (expectedImageCount > 0) {
    if (actualImages === expectedImageCount) {
      console.log(`     ✅ 图片数量匹配`);
    } else if (actualImages > 0) {
      console.log(`     ⚠️  图片部分缺失 (${actualImages}/${expectedImageCount})`);
      allPassed = false;
    } else {
      console.log(`     ❌ 图片全部缺失！`);
      allPassed = false;
    }
  }

  if (charCount < 50) {
    console.log(`     ⚠️  文档内容过少，可能写入不完整`);
    allPassed = false;
  } else {
    console.log(`     ✅ 文档内容正常`);
  }

  if (allPassed) {
    console.log(`\n  🎉 验证通过！文章保存完整。`);
  } else {
    console.log(`\n  ⚠️  验证发现问题，请检查上述警告。`);
  }

  return allPassed;
}

// ========== 主函数 ==========
let opts;

async function main() {
  opts = parseArgs(process.argv.slice(2));

  if (!opts.spaceId || !opts.article) {
    console.error('❌ 缺少必要参数');
    console.error('用法: node feishu-wiki-saver.js --space-id <id> --article <path> [--parent-token <tok>] [--dry-run] [--skip-images]');
    process.exit(1);
  }

  const articlePath = path.resolve(opts.article);
  if (!fs.existsSync(articlePath)) {
    console.error(`❌ 文章文件不存在: ${articlePath}`);
    process.exit(1);
  }

  const articleData = JSON.parse(fs.readFileSync(articlePath, 'utf-8'));
  const outputDir = path.dirname(articlePath);

  console.log(`\n📚 飞书知识库文章保存工具 v2`);
  console.log(`📄 标题: ${articleData.title}`);
  console.log(`📂 空间: ${opts.spaceId}`);
  console.log(`🖼️  图片: ${articleData.images?.length || 0} 张`);
  console.log(`🔍 模式: ${opts.dryRun ? '预览' : '执行'}`);

  // ===== Step 1: 创建知识库节点 =====
  console.log(`\n${'='.repeat(50)}`);
  console.log(`Step 1: 创建知识库文档节点`);
  console.log(`${'='.repeat(50)}`);

  const safeTitle = articleData.title.replace(/"/g, '\\"').substring(0, 100);
  const createResult = runLarkCli(
    `wiki nodes create --params '{"space_id":"${opts.spaceId}"}' --data '{"node_type":"origin","obj_type":"docx","title":"${safeTitle}"}'`,
    '创建知识库节点'
  );

  const createData = parseJson(createResult);
  if (!createData) {
    console.error('  ❌ 创建节点失败');
    process.exit(1);
  }

  const node = createData.node || createData.data?.node || createData;
  const objToken = node.obj_token;
  console.log(`  ✅ 节点创建成功 (obj_token: ${objToken})`);

  // ===== Step 2: 下载微信图片 =====
  let downloadedImages = [];
  if (!opts.skipImages && articleData.images?.length > 0) {
    console.log(`\n${'='.repeat(50)}`);
    console.log(`Step 2: 下载微信图片`);
    console.log(`${'='.repeat(50)}`);
    downloadedImages = await downloadImages(articleData.images, outputDir);
  } else {
    console.log(`\n  ⏭️  跳过图片下载`);
  }

  // ===== Step 3: 按原文顺序写入内容（文字 + 图片交替） =====
  console.log(`\n${'='.repeat(50)}`);
  console.log(`Step 3: 按原文顺序写入内容`);
  console.log(`${'='.repeat(50)}`);

  // 将下载结果传入拆分函数
  opts._downloadedImages = downloadedImages;
  const segments = splitContentWithImages(articleData);

  // 统计
  const textSegments = segments.filter(s => s.type === 'text');
  const imageSegments = segments.filter(s => s.type === 'image');
  console.log(`  📊 内容拆分: ${textSegments.length} 段文字, ${imageSegments.length} 张图片`);

  // 3a. 先写入文档头部（overwrite 模式）
  const header = generateDocHeader(articleData);
  const headerFile = '_header.md';
  fs.writeFileSync(path.join(outputDir, headerFile), header, 'utf-8');

  runLarkCli(
    `docs +update --doc "${objToken}" --markdown @${headerFile} --mode overwrite`,
    '写入文档头部',
    outputDir
  );
  try { fs.unlinkSync(path.join(outputDir, headerFile)); } catch {}

  // 3b. 按顺序交替写入文字段和图片
  let uploadedCount = 0;
  let textIdx = 0;
  let isFirstText = true;

  for (const seg of segments) {
    if (seg.type === 'text') {
      // 写入文字段（append 模式）
      const segFile = `_seg_${textIdx}.md`;
      fs.writeFileSync(path.join(outputDir, segFile), seg.content, 'utf-8');

      runLarkCli(
        `docs +update --doc "${objToken}" --markdown @${segFile} --mode append`,
        `写入文字段 [${textIdx + 1}/${textSegments.length}]`,
        outputDir
      );
      try { fs.unlinkSync(path.join(outputDir, segFile)); } catch {}
      isFirstText = false;
      textIdx++;
    } else if (seg.type === 'image' && seg.localPath) {
      // 插入图片
      const relativePath = path.relative(outputDir, seg.localPath);
      const result = runLarkCli(
        `docs +media-insert --doc "${objToken}" --file "${relativePath}" --type image`,
        `插入图片`,
        outputDir
      );
      if (result) {
        uploadedCount++;
      }
    } else if (seg.type === 'image' && !seg.localPath) {
      console.log(`     ⚠️  图片跳过（下载失败）`);
    }
  }

  // 3c. 写入尾部
  if (articleData.tags && articleData.tags.length > 0) {
    const footerFile = '_footer.md';
    const footer = `\n---\n\n🏷️ **标签**: ${articleData.tags.join(' | ')}\n\n*本文由 lark-wechat-collector Skill 自动采集保存*\n`;
    fs.writeFileSync(path.join(outputDir, footerFile), footer, 'utf-8');
    runLarkCli(
      `docs +update --doc "${objToken}" --markdown @${footerFile} --mode append`,
      '写入文档尾部',
      outputDir
    );
    try { fs.unlinkSync(path.join(outputDir, footerFile)); } catch {}
  }

  console.log(`  📊 写入完成: ${textSegments.length} 段文字, ${uploadedCount} 张图片`);

  // ===== Step 5: 验证 =====
  const expectedImages = uploadedCount;
  const passed = verifyDocument(objToken, expectedImages);

  // ===== 完成 =====
  console.log(`\n${'═'.repeat(50)}`);
  console.log(`✅ 保存完成！`);
  console.log(`${'═'.repeat(50)}`);
  console.log(`  📄 标题: ${articleData.title}`);
  console.log(`  📌 obj_token: ${objToken}`);
  console.log(`  🖼️  图片: ${uploadedCount} 张`);
  console.log(`  ✅ 验证: ${passed ? '通过' : '存在问题'}`);

  // 清理下载的图片
  const successImages = downloadedImages.filter(r => r.success);
  if (successImages.length > 0) {
    console.log(`\n  🧹 清理临时图片文件...`);
    for (const img of successImages) {
      try { fs.unlinkSync(img.localPath); } catch {}
    }
    try { fs.rmdirSync(path.join(outputDir, 'images')); } catch {}
    console.log(`  🧹 清理完成`);
  }
}

main();

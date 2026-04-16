#!/usr/bin/env node

/**
 * 微信公众号文章提取器
 * 功能：从微信公众号文章URL中提取结构化内容并生成完整页面截图
 *
 * 依赖：playwright（需提前安装：npm install playwright）
 *
 * 用法：
 *   node wechat-article-extractor.js <URL> [选项]
 *
 * 选项：
 *   --output <dir>       输出目录（默认：./output）
 *   --width <px>         浏览器视口宽度（默认：1280）
 *   --no-screenshot      不生成截图
 *   --content-only       仅提取内容，不处理图片
 *   --timeout <ms>       页面加载超时（默认：60000）
 *   --wait <ms>          页面加载后额外等待时间（默认：3000）
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// 解析命令行参数
function parseArgs(args) {
  const opts = {
    url: null,
    output: './output',
    width: 1280,
    screenshot: true,
    contentOnly: false,
    timeout: 60000,
    wait: 3000,
  };

  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case '--output':
        opts.output = args[++i];
        break;
      case '--width':
        opts.width = parseInt(args[++i], 10);
        break;
      case '--no-screenshot':
        opts.screenshot = false;
        break;
      case '--content-only':
        opts.contentOnly = true;
        break;
      case '--timeout':
        opts.timeout = parseInt(args[++i], 10);
        break;
      case '--wait':
        opts.wait = parseInt(args[++i], 10);
        break;
      default:
        if (!opts.url && args[i].startsWith('http')) {
          opts.url = args[i];
        }
    }
  }

  return opts;
}

// 验证 URL
function validateUrl(url) {
  if (!url) {
    console.error('错误：请提供微信公众号文章URL');
    process.exit(1);
  }
  const wechatPattern = /^https?:\/\/mp\.weixin\.qq\.com\//;
  if (!wechatPattern.test(url)) {
    console.error('错误：仅支持微信公众号文章链接（mp.weixin.qq.com）');
    process.exit(1);
  }
  return url;
}

// 生成提取脚本（使用 Playwright）
function generateExtractorScript(opts) {
  return `
const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
  });

  const context = await browser.newContext({
    viewport: { width: ${opts.width}, height: 800 },
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    locale: 'zh-CN',
  });

  const page = await context.newPage();

  try {
    // 导航到文章页面
    await page.goto('${opts.url}', {
      waitUntil: 'networkidle',
      timeout: ${opts.timeout}
    });

    // 额外等待确保动态内容加载
    await page.waitForTimeout(${opts.wait});

    // 滚动到底部触发懒加载
    await autoScroll(page);
    await page.waitForTimeout(2000);

    // 提取文章内容
    const articleData = await page.evaluate(() => {
      const result = {
        title: '',
        author: '',
        publishDate: '',
        content: '',
        wordCount: 0,
        images: [],
        tags: [],
        summary: '',
      };

      // 标题
      const titleEl = document.querySelector('#activity-name') ||
                      document.querySelector('.rich_media_title') ||
                      document.querySelector('h1');
      result.title = titleEl ? titleEl.textContent.trim() : '';

      // 作者
      const authorEl = document.querySelector('#js_name') ||
                       document.querySelector('.rich_media_meta_nickname a') ||
                       document.querySelector('.profile_nickname');
      result.author = authorEl ? authorEl.textContent.trim() : '';

      // 发布日期
      const dateEl = document.querySelector('#publish_time') ||
                     document.querySelector('.rich_media_meta_primary_category_text') ||
                     document.querySelector('#create_time');
      if (dateEl) {
        const dateText = dateEl.textContent.trim();
        result.publishDate = dateText;
      }

      // 正文内容
      const contentEl = document.querySelector('#js_content') ||
                        document.querySelector('.rich_media_content');
      if (contentEl) {
        // 转换为 Markdown
        result.content = htmlToMarkdown(contentEl);
        result.wordCount = result.content.replace(/\\s/g, '').length;
      }

      // 提取图片
      const imgEls = contentEl ? contentEl.querySelectorAll('img') : [];
      imgEls.forEach(img => {
        const src = img.getAttribute('data-src') || img.src;
        if (src && !src.includes('data:image')) {
          result.images.push({
            src: src,
            alt: img.alt || '',
            width: img.naturalWidth || img.width || 0,
            height: img.naturalHeight || img.height || 0,
          });
        }
      });

      // 提取标签/关键词（从文章开头或结尾提取）
      const tagEls = document.querySelectorAll('#js_tags .weui-desktop-account__nickname, .rich_media_meta_primary_category_text');
      tagEls.forEach(el => {
        const tag = el.textContent.trim();
        if (tag) result.tags.push(tag);
      });

      // 生成摘要（取正文前200字）
      if (result.content) {
        result.summary = result.content.replace(/[#*\\[\\]()>_-]/g, '').substring(0, 200).trim() + '...';
      }

      return result;
    });

    // 输出结果
    console.log('ARTICLE_DATA_START');
    console.log(JSON.stringify(articleData, null, 2));
    console.log('ARTICLE_DATA_END');

    // 截图
    ${opts.screenshot ? `
    const screenshotPath = '${path.resolve(opts.output, 'screenshot.png')}';
    await page.screenshot({
      path: screenshotPath,
      fullPage: true,
      type: 'png',
    });
    console.log('SCREENSHOT_DONE:' + screenshotPath);
    ` : 'console.log("SCREENSHOT_SKIPPED");'}

  } catch (error) {
    console.error('提取失败:', error.message);
    process.exit(1);
  } finally {
    await browser.close();
  }

  // 自动滚动函数
  async function autoScroll(page) {
    await page.evaluate(async () => {
      await new Promise((resolve) => {
        let totalHeight = 0;
        const distance = 300;
        const timer = setInterval(() => {
          const scrollHeight = document.body.scrollHeight;
          window.scrollBy(0, distance);
          totalHeight += distance;
          if (totalHeight >= scrollHeight - window.innerHeight) {
            clearInterval(timer);
            resolve();
          }
        }, 200);
      });
    });
  }

  // HTML 转 Markdown 函数
  function htmlToMarkdown(element) {
    let markdown = '';
    const children = element.childNodes;

    for (const child of children) {
      if (child.nodeType === Node.TEXT_NODE) {
        markdown += child.textContent;
      } else if (child.nodeType === Node.ELEMENT_NODE) {
        const tag = child.tagName.toLowerCase();

        switch (tag) {
          case 'h1':
            markdown += '\\n# ' + child.textContent.trim() + '\\n\\n';
            break;
          case 'h2':
            markdown += '\\n## ' + child.textContent.trim() + '\\n\\n';
            break;
          case 'h3':
            markdown += '\\n### ' + child.textContent.trim() + '\\n\\n';
            break;
          case 'h4':
            markdown += '\\n#### ' + child.textContent.trim() + '\\n\\n';
            break;
          case 'p':
            markdown += child.textContent.trim() + '\\n\\n';
            break;
          case 'br':
            markdown += '\\n';
            break;
          case 'strong':
          case 'b':
            markdown += '**' + child.textContent.trim() + '**';
            break;
          case 'em':
          case 'i':
            markdown += '*' + child.textContent.trim() + '*';
            break;
          case 'blockquote':
            markdown += '\\n> ' + child.textContent.trim().replace(/\\n/g, '\\n> ') + '\\n\\n';
            break;
          case 'ul':
          case 'ol':
            markdown += '\\n';
            const items = child.querySelectorAll(':scope > li');
            items.forEach((li, idx) => {
              const prefix = tag === 'ol' ? (idx + 1) + '. ' : '- ';
              markdown += prefix + li.textContent.trim() + '\\n';
            });
            markdown += '\\n';
            break;
          case 'pre':
          case 'code':
            if (child.querySelector('code') || tag === 'pre') {
              const code = child.querySelector('code') ? child.querySelector('code').textContent : child.textContent;
              markdown += '\\n\`\`\`\\n' + code.trim() + '\\n\`\`\`\\n\\n';
            } else {
              markdown += '\`' + child.textContent.trim() + '\`';
            }
            break;
          case 'img': {
            const src = child.getAttribute('data-src') || child.src;
            const alt = child.alt || '';
            if (src && !src.includes('data:image')) {
              markdown += '\\n![' + alt + '](' + src + ')\\n\\n';
            }
            break;
          }
          case 'a': {
            const href = child.href || '#';
            const text = child.textContent.trim();
            markdown += '[' + text + '](' + href + ')';
            break;
          }
          case 'hr':
            markdown += '\\n---\\n\\n';
            break;
          case 'table':
            markdown += convertTable(child);
            break;
          case 'section':
          case 'div':
            markdown += htmlToMarkdown(child);
            break;
          default:
            markdown += htmlToMarkdown(child);
        }
      }
    }

    return markdown.replace(/\\n{3,}/g, '\\n\\n').trim();
  }

  // 表格转 Markdown
  function convertTable(tableEl) {
    const rows = tableEl.querySelectorAll('tr');
    if (rows.length === 0) return '';

    let md = '\\n';
    rows.forEach((row, rowIdx) => {
      const cells = row.querySelectorAll('th, td');
      const line = '| ' + Array.from(cells).map(c => c.textContent.trim()).join(' | ') + ' |';
      md += line + '\\n';

      if (rowIdx === 0) {
        md += '| ' + Array.from(cells).map(() => '---').join(' | ') + ' |\\n';
      }
    });
    md += '\\n';
    return md;
  }
})();
`;
}

// 主函数
async function main() {
  const args = parseArgs(process.argv.slice(2));
  const url = validateUrl(args.url);

  // 创建输出目录
  const outputDir = path.resolve(args.output);
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  console.log(`\n📌 微信公众号文章提取器`);
  console.log(`🔗 URL: ${url}`);
  console.log(`📁 输出目录: ${outputDir}`);
  console.log(`📐 视口宽度: ${args.width}px`);
  console.log(`📸 截图: ${args.screenshot ? '开启' : '关闭'}`);
  console.log(`\n⏳ 正在提取文章内容...\n`);

  // 检查 playwright 是否安装
  try {
    require.resolve('playwright');
  } catch (e) {
    console.error('❌ 错误：未安装 playwright');
    console.error('请运行: npm install playwright && npx playwright install chromium');
    process.exit(1);
  }

  // 生成并执行提取脚本
  const scriptContent = generateExtractorScript(args);
  const scriptPath = path.join(outputDir, '_extractor_temp.js');
  fs.writeFileSync(scriptPath, scriptContent, 'utf-8');

  try {
    const result = execSync(`node "${scriptPath}"`, {
      encoding: 'utf-8',
      timeout: args.timeout + 30000,
      maxBuffer: 50 * 1024 * 1024,
    });

    // 解析输出
    const dataMatch = result.match(/ARTICLE_DATA_START\n([\s\S]*?)\nARTICLE_DATA_END/);
    const screenshotMatch = result.match(/SCREENSHOT_DONE:(.+)/);

    if (dataMatch) {
      const articleData = JSON.parse(dataMatch[1]);

      // 添加元信息
      const metadata = {
        url: url,
        extractedAt: new Date().toISOString(),
        extractorVersion: '1.0.0',
        options: {
          width: args.width,
          screenshot: args.screenshot,
        },
      };

      // 保存文章数据
      fs.writeFileSync(
        path.join(outputDir, 'article.json'),
        JSON.stringify(articleData, null, 2),
        'utf-8'
      );

      // 保存元信息
      fs.writeFileSync(
        path.join(outputDir, 'metadata.json'),
        JSON.stringify(metadata, null, 2),
        'utf-8'
      );

      // 输出结果摘要
      console.log(`\n✅ 提取完成！\n`);
      console.log(`📄 标题: ${articleData.title}`);
      console.log(`✍️  作者: ${articleData.author}`);
      console.log(`📅 日期: ${articleData.publishDate}`);
      console.log(`📝 字数: ${articleData.wordCount}`);
      console.log(`🖼️  图片: ${articleData.images.length} 张`);
      if (articleData.tags.length > 0) {
        console.log(`🏷️  标签: ${articleData.tags.join(', ')}`);
      }
      console.log(`\n📁 输出文件:`);
      console.log(`   ├── article.json    (文章内容)`);
      console.log(`   ├── metadata.json   (元信息)`);
      if (screenshotMatch) {
        console.log(`   └── screenshot.png  (页面截图)`);
      }
      console.log(`\n📂 输出目录: ${outputDir}`);
    } else {
      console.error('❌ 未能提取文章数据');
      console.error('原始输出:', result);
      process.exit(1);
    }
  } catch (error) {
    console.error('❌ 执行失败:', error.message);
    process.exit(1);
  } finally {
    // 清理临时脚本
    try {
      fs.unlinkSync(scriptPath);
    } catch (e) {
      // 忽略清理错误
    }
  }
}

main();

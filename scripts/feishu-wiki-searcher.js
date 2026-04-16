#!/usr/bin/env node

/**
 * 飞书知识库文章检索工具
 * 功能：从飞书知识库中检索文章，支持关键词搜索和全文匹配
 *
 * 依赖：lark-cli（需提前安装并完成认证）
 *
 * 用法：
 *   node feishu-wiki-searcher.js --space-id <space_id> --query <关键词> [--max-results <n>] [--full-text]
 *
 * 选项：
 *   --space-id <id>       知识库空间ID
 *   --parent-token <tok>  搜索的起始节点token（可选，默认搜索整个空间）
 *   --query <text>        搜索关键词
 *   --max-results <n>     最大返回结果数（默认：10）
 *   --full-text           是否读取文章全文（默认仅返回标题和摘要）
 *   --output <path>       输出结果到JSON文件（可选）
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// 解析命令行参数
function parseArgs(args) {
  const opts = {
    spaceId: null,
    parentToken: null,
    query: null,
    maxResults: 10,
    fullText: false,
    output: null,
  };

  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case '--space-id':
        opts.spaceId = args[++i];
        break;
      case '--parent-token':
        opts.parentToken = args[++i];
        break;
      case '--query':
        opts.query = args[++i];
        break;
      case '--max-results':
        opts.maxResults = parseInt(args[++i], 10);
        break;
      case '--full-text':
        opts.fullText = true;
        break;
      case '--output':
        opts.output = args[++i];
        break;
    }
  }

  return opts;
}

// 执行 lark-cli 命令
function runLarkCli(command) {
  try {
    const result = execSync(`lark-cli ${command}`, {
      encoding: 'utf-8',
      timeout: 30000,
      maxBuffer: 10 * 1024 * 1024,
    });
    return result.trim();
  } catch (error) {
    console.error(`命令执行失败: lark-cli ${command.substring(0, 80)}...`);
    console.error(`错误: ${error.message}`);
    return null;
  }
}

// 解析 JSON 输出
function parseJsonOutput(output) {
  if (!output) return null;
  try {
    const jsonMatch = output.match(/\{[\s\S]*\}/);
    if (jsonMatch) return JSON.parse(jsonMatch[0]);
    return JSON.parse(output);
  } catch (e) {
    return null;
  }
}

// 递归获取知识库节点
function listAllNodes(spaceId, parentToken, depth = 0) {
  const nodes = [];

  const parentArg = parentToken
    ? `--parent-node-token "${parentToken}"`
    : '';

  const result = runLarkCli(
    `wiki nodes list --space-id "${spaceId}" ${parentArg} --format json --page-all`
  );

  const data = parseJsonOutput(result);
  if (!data) return nodes;

  const items = data.items || data.data?.items || [];
  for (const item of items) {
    const node = {
      nodeToken: item.node_token,
      objToken: item.obj_token,
      title: item.title,
      nodeType: item.node_type,
      depth: depth,
      hasChild: item.has_child || false,
    };
    nodes.push(node);

    // 递归获取子节点（限制深度为3层）
    if (node.hasChild && depth < 3) {
      const childNodes = listAllNodes(spaceId, node.nodeToken, depth + 1);
      nodes.push(...childNodes);
    }
  }

  return nodes;
}

// 关键词匹配评分
function scoreNode(node, query) {
  const keywords = query.toLowerCase().split(/\s+/);
  let score = 0;
  const title = (node.title || '').toLowerCase();

  for (const kw of keywords) {
    if (title.includes(kw)) {
      score += 10; // 标题匹配权重高
    }
  }

  // 精确匹配加分
  if (title.includes(query.toLowerCase())) {
    score += 20;
  }

  return score;
}

// 读取文档内容
function fetchDocContent(objToken) {
  const result = runLarkCli(
    `docs +fetch --doc "${objToken}" --format json`
  );

  if (!result) return null;

  // docs +fetch 默认输出 Markdown 文本，尝试解析
  try {
    const jsonMatch = result.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const data = JSON.parse(jsonMatch[0]);
      return data.content || data.markdown || data.text || result;
    }
    return result;
  } catch (e) {
    return result;
  }
}

// 主函数
async function main() {
  const opts = parseArgs(process.argv.slice(2));

  if (!opts.spaceId || !opts.query) {
    console.error('❌ 缺少必要参数');
    console.error('用法: node feishu-wiki-searcher.js --space-id <id> --query <关键词>');
    process.exit(1);
  }

  console.log(`\n🔍 飞书知识库文章检索`);
  console.log(`📂 知识库空间: ${opts.spaceId}`);
  console.log(`🔎 搜索关键词: "${opts.query}"`);
  console.log(`📊 最大结果数: ${opts.maxResults}`);
  console.log(`\n⏳ 正在检索...\n`);

  // Step 1: 列出所有节点
  const allNodes = listAllNodes(opts.spaceId, opts.parentToken);
  console.log(`📁 共找到 ${allNodes.length} 个节点`);

  // Step 2: 关键词匹配和排序
  const scoredNodes = allNodes
    .map(node => ({ ...node, score: scoreNode(node, opts.query) }))
    .filter(node => node.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, opts.maxResults);

  console.log(`🎯 匹配到 ${scoredNodes.length} 篇相关文章\n`);

  if (scoredNodes.length === 0) {
    console.log('未找到相关文章。请尝试其他关键词。');
    return;
  }

  // Step 3: 输出结果
  const results = [];

  for (let i = 0; i < scoredNodes.length; i++) {
    const node = scoredNodes[i];
    console.log(`${'─'.repeat(60)}`);
    console.log(`[${i + 1}] ${node.title}`);
    console.log(`    匹配度: ${'★'.repeat(Math.min(Math.ceil(node.score / 5), 10))} (${node.score}分)`);
    console.log(`    节点Token: ${node.nodeToken}`);
    console.log(`    文档Token: ${node.objToken}`);
    console.log(`    层级深度: ${node.depth}`);

    const result = {
      rank: i + 1,
      title: node.title,
      score: node.score,
      nodeToken: node.nodeToken,
      objToken: node.objToken,
      depth: node.depth,
    };

    // 可选：读取全文
    if (opts.fullText && node.objToken) {
      console.log(`    ⏳ 读取全文...`);
      const content = fetchDocContent(node.objToken);
      if (content) {
        result.content = content;
        const preview = content.replace(/[#*\[\]>_\-]/g, '').substring(0, 150);
        console.log(`    📝 预览: ${preview}...`);
      }
    }

    results.push(result);
  }

  console.log(`\n${'═'.repeat(60)}`);
  console.log(`✅ 检索完成，共 ${results.length} 条结果`);
  console.log(`${'═'.repeat(60)}`);

  // 输出 JSON 结果
  const outputData = {
    query: opts.query,
    spaceId: opts.spaceId,
    totalNodes: allNodes.length,
    matchedCount: results.length,
    results: results,
    searchedAt: new Date().toISOString(),
  };

  if (opts.output) {
    fs.writeFileSync(opts.output, JSON.stringify(outputData, null, 2), 'utf-8');
    console.log(`\n💾 结果已保存到: ${opts.output}`);
  } else {
    console.log(`\n📋 JSON 结果:\n`);
    console.log(JSON.stringify(outputData, null, 2));
  }
}

main();

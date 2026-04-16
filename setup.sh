#!/bin/bash
set -e

echo "📰 lark-wechat-collector 安装脚本"
echo "=============================="
echo ""

# 检查 Node.js
if ! command -v node &> /dev/null; then
    echo "❌ 未检测到 Node.js，请先安装 Node.js >= 18"
    echo "   https://nodejs.org/"
    exit 1
fi

NODE_VERSION=$(node -v | sed 's/v//' | cut -d. -f1)
if [ "$NODE_VERSION" -lt 18 ]; then
    echo "❌ Node.js 版本过低（当前: $(node -v)，需要: >= 18）"
    exit 1
fi
echo "✅ Node.js $(node -v)"

# 检查/安装 lark-cli
if ! command -v lark-cli &> /dev/null; then
    echo "📦 安装 lark-cli..."
    npm install -g @larksuite/cli
    echo "✅ lark-cli 安装完成"
else
    echo "✅ lark-cli $(lark-cli --version 2>/dev/null | head -1 || echo '已安装')"
fi

# 安装官方 Skills
echo ""
echo "📦 安装官方 Skills（lark-shared 等基础依赖）..."
npx skills add https://github.com/larksuite/cli -y -g 2>/dev/null || true
echo "✅ 官方 Skills 安装完成"

# 安装 lark-wechat-collector Skill
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
echo ""
echo "📦 安装 lark-wechat-collector Skill..."
npx skills add "$SCRIPT_DIR/skills/lark-wechat-collector" -y -g 2>/dev/null || \
npx skills add "$SCRIPT_DIR" -y -g 2>/dev/null || \
echo "⚠️  Skill 安装失败，请手动运行: npx skills add $SCRIPT_DIR/skills/lark-wechat-collector -y -g"

# 安装 npm 依赖
echo ""
echo "📦 安装脚本依赖..."
cd "$SCRIPT_DIR"
npm install --production 2>/dev/null || npm install 2>/dev/null
echo "✅ 依赖安装完成"

# 提示配置
echo ""
echo "=============================="
echo "🎉 安装完成！"
echo ""
echo "下一步："
echo "  1. 配置飞书应用: lark-cli config init --new"
echo "  2. 登录授权:     lark-cli auth login --recommend"
echo "  3. 重启 AI Agent 工具（Trae / Cursor / Claude Code）"
echo ""
echo "使用示例："
echo '  "帮我收藏这篇微信文章：https://mp.weixin.qq.com/s/xxxxx"'
echo ""

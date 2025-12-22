#!/bin/bash
# ========== P2P Chat 代码部署脚本 ==========

set -e

# 配置变量
APP_DIR="/var/www/p2p-chat"
REPO_URL="https://github.com/a994335223/zb.git"
BRANCH="main"

echo "🚀 开始部署 P2P Chat..."

# ========== 1. 克隆/更新代码 ==========
if [ -d "$APP_DIR" ]; then
    echo "📂 更新代码..."
    cd $APP_DIR
    git fetch origin
    git reset --hard origin/$BRANCH
else
    echo "📂 克隆代码..."
    mkdir -p $APP_DIR
    git clone -b $BRANCH $REPO_URL $APP_DIR
    cd $APP_DIR
fi

# ========== 2. 构建前端 ==========
echo "🔨 构建前端..."
cd $APP_DIR/p2p-chat/client

# 创建生产环境配置（如果不存在）
if [ ! -f ".env.production" ]; then
    echo "⚠️ 请先创建 .env.production 配置文件！"
    echo "参考: env.production.example"
    exit 1
fi

npm install
npm run build

# ========== 3. 部署后端 ==========
echo "🔨 部署后端..."
cd $APP_DIR/p2p-chat/server
npm install
npm run build

# ========== 4. 使用 PM2 启动/重启服务 ==========
echo "🔄 启动服务..."
pm2 delete p2p-chat-server 2>/dev/null || true
pm2 start dist/index.js --name p2p-chat-server

# 保存 PM2 配置（开机自启）
pm2 save
pm2 startup

# ========== 5. 重启 Nginx ==========
echo "🔄 重启 Nginx..."
nginx -t
systemctl reload nginx

# ========== 6. 重启 coturn ==========
echo "🔄 重启 coturn..."
systemctl restart coturn
systemctl enable coturn

echo ""
echo "✅ 部署完成！"
echo ""
echo "📊 服务状态:"
pm2 status
echo ""
echo "🔗 访问地址: https://your-domain.com"


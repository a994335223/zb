#!/bin/bash
# ========== P2P Chat 服务器部署脚本 ==========
# 适用于 Ubuntu 24.04 LTS

set -e

echo "🚀 开始部署 P2P Chat 服务器..."

# ========== 1. 系统更新 ==========
echo "📦 更新系统..."
apt update && apt upgrade -y

# ========== 2. 安装 Node.js 20 ==========
echo "📦 安装 Node.js 20..."
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt install -y nodejs

# 验证安装
node -v
npm -v

# ========== 3. 安装 PM2 进程管理器 ==========
echo "📦 安装 PM2..."
npm install -g pm2

# ========== 4. 安装 Nginx ==========
echo "📦 安装 Nginx..."
apt install -y nginx

# ========== 5. 安装 coturn (STUN/TURN) ==========
echo "📦 安装 coturn..."
apt install -y coturn

# 启用 coturn 服务
sed -i 's/#TURNSERVER_ENABLED=1/TURNSERVER_ENABLED=1/' /etc/default/coturn

# ========== 6. 安装 Certbot (SSL证书) ==========
echo "📦 安装 Certbot..."
apt install -y certbot python3-certbot-nginx

# ========== 7. 配置防火墙 ==========
echo "🔥 配置防火墙..."
ufw allow 22/tcp      # SSH
ufw allow 80/tcp      # HTTP
ufw allow 443/tcp     # HTTPS
ufw allow 3478/tcp    # STUN/TURN TCP
ufw allow 3478/udp    # STUN/TURN UDP
ufw allow 5349/tcp    # TURNS (TLS)
ufw allow 5349/udp    # TURNS (DTLS)
ufw allow 49152:65535/udp  # WebRTC 媒体端口

# 启用防火墙（首次需要确认）
# ufw enable

echo "✅ 基础环境安装完成！"
echo ""
echo "📋 下一步操作："
echo "  1. 配置域名 DNS 解析到此服务器"
echo "  2. 获取 SSL 证书: certbot --nginx -d your-domain.com"
echo "  3. 配置 coturn: cp coturn.conf /etc/turnserver.conf"
echo "  4. 配置 Nginx: cp nginx.conf /etc/nginx/sites-available/p2p-chat"
echo "  5. 部署代码: 运行 deploy.sh"


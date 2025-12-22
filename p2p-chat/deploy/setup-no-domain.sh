#!/bin/bash
# ========== P2P Chat 无域名部署脚本 ==========
# 使用 IP 地址 + 自签名证书
# 服务器: Ubuntu 24.04 LTS

set -e

SERVER_IP="173.208.218.151"

echo "🚀 开始部署 P2P Chat（无域名模式）..."
echo "📍 服务器 IP: $SERVER_IP"

# ========== 1. 系统更新 ==========
echo ""
echo "📦 [1/8] 更新系统..."
apt update && apt upgrade -y

# ========== 2. 安装 Node.js 20 ==========
echo ""
echo "📦 [2/8] 安装 Node.js 20..."
if ! command -v node &> /dev/null; then
    curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
    apt install -y nodejs
fi
echo "   Node.js: $(node -v)"
echo "   npm: $(npm -v)"

# ========== 3. 安装 PM2 ==========
echo ""
echo "📦 [3/8] 安装 PM2..."
npm install -g pm2

# ========== 4. 安装 Nginx ==========
echo ""
echo "📦 [4/8] 安装 Nginx..."
apt install -y nginx

# ========== 5. 安装 coturn ==========
echo ""
echo "📦 [5/8] 安装 coturn..."
apt install -y coturn
sed -i 's/#TURNSERVER_ENABLED=1/TURNSERVER_ENABLED=1/' /etc/default/coturn

# ========== 6. 生成自签名证书 ==========
echo ""
echo "🔐 [6/8] 生成自签名 SSL 证书..."
mkdir -p /etc/ssl/private

openssl req -x509 -nodes -days 3650 -newkey rsa:2048 \
    -keyout /etc/ssl/private/p2p-chat.key \
    -out /etc/ssl/certs/p2p-chat.crt \
    -subj "/C=CN/ST=HK/L=HongKong/O=P2PChat/OU=WebRTC/CN=$SERVER_IP" \
    -addext "subjectAltName=IP:$SERVER_IP"

chmod 600 /etc/ssl/private/p2p-chat.key
echo "   ✅ 证书已生成: /etc/ssl/certs/p2p-chat.crt"

# ========== 7. 配置防火墙 ==========
echo ""
echo "🔥 [7/8] 配置防火墙..."
ufw allow 22/tcp
ufw allow 80/tcp
ufw allow 443/tcp
ufw allow 3478/tcp
ufw allow 3478/udp
ufw allow 5349/tcp
ufw allow 5349/udp
ufw allow 49152:65535/udp
echo "y" | ufw enable || true
ufw status

# ========== 8. 配置 coturn ==========
echo ""
echo "⚙️ [8/8] 配置 coturn..."

# 生成随机密码
TURN_PASSWORD=$(openssl rand -base64 16)

cat > /etc/turnserver.conf << EOF
# P2P Chat TURN Server Configuration
listening-port=3478
tls-listening-port=5349
listening-ip=$SERVER_IP
external-ip=$SERVER_IP
min-port=49152
max-port=65535
verbose
log-file=/var/log/turnserver/turnserver.log
realm=$SERVER_IP
user=webrtc:$TURN_PASSWORD
lt-cred-mech
fingerprint
no-cli
EOF

# 创建日志目录
mkdir -p /var/log/turnserver
chown turnserver:turnserver /var/log/turnserver

# 启动 coturn
systemctl restart coturn
systemctl enable coturn

echo ""
echo "============================================"
echo "✅ 基础环境安装完成！"
echo "============================================"
echo ""
echo "📋 重要信息（请保存）:"
echo "   服务器 IP: $SERVER_IP"
echo "   TURN 用户名: webrtc"
echo "   TURN 密码: $TURN_PASSWORD"
echo ""
echo "📋 下一步操作:"
echo "   1. 克隆代码到服务器"
echo "   2. 创建前端 .env.production 配置"
echo "   3. 构建并部署"
echo ""
echo "🔗 访问地址: https://$SERVER_IP"
echo "   (首次访问需要点击'继续访问'忽略证书警告)"
echo ""


#!/bin/bash
# ========== P2P Chat 完整一键部署脚本 ==========
# 适用于全新 Ubuntu 24.04 服务器，无需域名

set -e

SERVER_IP="173.208.218.151"
APP_DIR="/var/www/p2p-chat"
REPO_URL="https://github.com/a994335223/zb.git"

echo "🚀 P2P Chat 一键部署开始..."
echo "📍 服务器: $SERVER_IP"
echo ""

# ========== 1. 系统更新 ==========
echo "📦 [1/10] 更新系统..."
apt update && apt upgrade -y

# ========== 2. 安装依赖 ==========
echo "📦 [2/10] 安装依赖..."
apt install -y git curl

# ========== 3. 安装 Node.js ==========
echo "📦 [3/10] 安装 Node.js 20..."
if ! command -v node &> /dev/null; then
    curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
    apt install -y nodejs
fi

# ========== 4. 安装 PM2 ==========
echo "📦 [4/10] 安装 PM2..."
npm install -g pm2

# ========== 5. 安装 Nginx & coturn ==========
echo "📦 [5/10] 安装 Nginx 和 coturn..."
apt install -y nginx coturn
sed -i 's/#TURNSERVER_ENABLED=1/TURNSERVER_ENABLED=1/' /etc/default/coturn

# ========== 6. 生成 SSL 证书 ==========
echo "🔐 [6/10] 生成自签名证书..."
openssl req -x509 -nodes -days 3650 -newkey rsa:2048 \
    -keyout /etc/ssl/private/p2p-chat.key \
    -out /etc/ssl/certs/p2p-chat.crt \
    -subj "/CN=$SERVER_IP" \
    -addext "subjectAltName=IP:$SERVER_IP" 2>/dev/null

chmod 600 /etc/ssl/private/p2p-chat.key

# ========== 7. 配置 coturn ==========
echo "⚙️ [7/10] 配置 TURN 服务器..."
TURN_PASSWORD=$(openssl rand -base64 12)

cat > /etc/turnserver.conf << EOF
listening-port=3478
tls-listening-port=5349
listening-ip=$SERVER_IP
external-ip=$SERVER_IP
min-port=49152
max-port=65535
realm=$SERVER_IP
user=webrtc:$TURN_PASSWORD
lt-cred-mech
fingerprint
no-cli
EOF

mkdir -p /var/log/turnserver
chown turnserver:turnserver /var/log/turnserver
systemctl restart coturn
systemctl enable coturn

# ========== 8. 克隆并构建代码 ==========
echo "📂 [8/10] 克隆代码..."
rm -rf $APP_DIR
git clone $REPO_URL $APP_DIR
cd $APP_DIR/p2p-chat

# 创建前端环境配置
echo "⚙️ 配置前端环境变量..."
cat > client/.env.production << EOF
VITE_STUN_URL=stun:$SERVER_IP:3478
VITE_TURN_URL=turn:$SERVER_IP:3478
VITE_TURN_USER=webrtc
VITE_TURN_PASS=$TURN_PASSWORD
EOF

# 构建前端
echo "🔨 构建前端..."
cd client
npm install
npm run build

# 构建后端
echo "🔨 构建后端..."
cd ../server
npm install
npm run build

# ========== 9. 配置 Nginx ==========
echo "⚙️ [9/10] 配置 Nginx..."
cat > /etc/nginx/sites-available/p2p-chat << EOF
server {
    listen 80;
    server_name $SERVER_IP;
    return 301 https://\$server_name\$request_uri;
}

server {
    listen 443 ssl http2;
    server_name $SERVER_IP;

    ssl_certificate /etc/ssl/certs/p2p-chat.crt;
    ssl_certificate_key /etc/ssl/private/p2p-chat.key;
    ssl_protocols TLSv1.2 TLSv1.3;

    root $APP_DIR/p2p-chat/client/dist;
    index index.html;

    location / {
        try_files \$uri \$uri/ /index.html;
    }

    location /socket.io/ {
        proxy_pass http://127.0.0.1:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host \$host;
        proxy_connect_timeout 7d;
        proxy_send_timeout 7d;
        proxy_read_timeout 7d;
    }

    location /health {
        proxy_pass http://127.0.0.1:3001;
    }
}
EOF

rm -f /etc/nginx/sites-enabled/default
ln -sf /etc/nginx/sites-available/p2p-chat /etc/nginx/sites-enabled/
nginx -t
systemctl reload nginx

# ========== 10. 启动服务 ==========
echo "🚀 [10/10] 启动后端服务..."
cd $APP_DIR/p2p-chat/server
pm2 delete p2p-chat 2>/dev/null || true
pm2 start dist/index.js --name p2p-chat
pm2 save
pm2 startup systemd -u root --hp /root

# ========== 配置防火墙 ==========
echo "🔥 配置防火墙..."
ufw allow 22/tcp
ufw allow 80/tcp
ufw allow 443/tcp
ufw allow 3478/tcp
ufw allow 3478/udp
ufw allow 5349/tcp
ufw allow 5349/udp
ufw allow 49152:65535/udp
echo "y" | ufw enable 2>/dev/null || true

# ========== 完成 ==========
echo ""
echo "============================================"
echo "🎉 部署完成！"
echo "============================================"
echo ""
echo "📋 服务信息:"
echo "   访问地址: https://$SERVER_IP"
echo "   TURN 用户: webrtc"
echo "   TURN 密码: $TURN_PASSWORD"
echo ""
echo "⚠️ 首次访问浏览器会提示'不安全'，点击'高级'->'继续访问'即可"
echo ""
echo "📊 服务状态:"
pm2 status
echo ""
echo "📝 常用命令:"
echo "   查看日志: pm2 logs p2p-chat"
echo "   重启服务: pm2 restart p2p-chat"
echo "   查看状态: pm2 status"
echo ""


#!/bin/bash
# ========== P2P Chat 完整一键部署脚本 ==========
# 适用于全新 Ubuntu 24.04 服务器，无需域名
# 所有日志保存到 /var/log/p2p-chat-deploy.log

# 配置
SERVER_IP="173.208.218.151"
APP_DIR="/var/www/p2p-chat"
REPO_URL="https://github.com/a994335223/zb.git"
LOG_FILE="/var/log/p2p-chat-deploy.log"

# 颜色输出
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 日志函数
log() {
    local level=$1
    local message=$2
    local timestamp=$(date '+%Y-%m-%d %H:%M:%S')
    echo -e "${timestamp} [${level}] ${message}" | tee -a $LOG_FILE
}

info() {
    log "INFO" "${BLUE}$1${NC}"
}

success() {
    log "SUCCESS" "${GREEN}✅ $1${NC}"
}

warning() {
    log "WARNING" "${YELLOW}⚠️ $1${NC}"
}

error() {
    log "ERROR" "${RED}❌ $1${NC}"
}

# 错误处理函数
handle_error() {
    local exit_code=$?
    local line_number=$1
    error "脚本在第 $line_number 行出错，退出码: $exit_code"
    error "请查看日志文件: $LOG_FILE"
    error "或运行: tail -100 $LOG_FILE"
    exit $exit_code
}

# 设置错误捕获
trap 'handle_error $LINENO' ERR

# 检查命令是否成功
check_command() {
    if [ $? -eq 0 ]; then
        success "$1"
    else
        error "$1 失败！"
        exit 1
    fi
}

# 开始部署
echo ""
echo "========================================================"
echo "🚀 P2P Chat 一键部署脚本"
echo "========================================================"
echo "📍 服务器 IP: $SERVER_IP"
echo "📁 安装目录: $APP_DIR"
echo "📝 日志文件: $LOG_FILE"
echo "========================================================"
echo ""

# 创建日志文件
mkdir -p $(dirname $LOG_FILE)
echo "========== 部署开始: $(date) ==========" > $LOG_FILE

# ========== 1. 系统更新 ==========
info "[1/12] 更新系统软件包..."
apt update >> $LOG_FILE 2>&1
check_command "系统更新"

# ========== 2. 安装基础依赖 ==========
info "[2/12] 安装基础依赖 (git, curl, build-essential)..."
apt install -y git curl build-essential >> $LOG_FILE 2>&1
check_command "基础依赖安装"

# ========== 3. 安装 Node.js ==========
info "[3/12] 安装 Node.js 20..."
if command -v node &> /dev/null; then
    NODE_VERSION=$(node -v)
    warning "Node.js 已安装: $NODE_VERSION"
else
    curl -fsSL https://deb.nodesource.com/setup_20.x | bash - >> $LOG_FILE 2>&1
    apt install -y nodejs >> $LOG_FILE 2>&1
fi
NODE_VERSION=$(node -v 2>/dev/null || echo "未安装")
NPM_VERSION=$(npm -v 2>/dev/null || echo "未安装")
success "Node.js: $NODE_VERSION, npm: $NPM_VERSION"

# ========== 4. 安装 PM2 ==========
info "[4/12] 安装 PM2 进程管理器..."
npm install -g pm2 >> $LOG_FILE 2>&1
check_command "PM2 安装"

# ========== 5. 安装 Nginx ==========
info "[5/12] 安装 Nginx..."
apt install -y nginx >> $LOG_FILE 2>&1
check_command "Nginx 安装"

# ========== 6. 安装 coturn ==========
info "[6/12] 安装 coturn (STUN/TURN 服务器)..."
apt install -y coturn >> $LOG_FILE 2>&1
sed -i 's/#TURNSERVER_ENABLED=1/TURNSERVER_ENABLED=1/' /etc/default/coturn
check_command "coturn 安装"

# ========== 7. 生成 SSL 证书 ==========
info "[7/12] 生成自签名 SSL 证书..."
mkdir -p /etc/ssl/private

if [ -f /etc/ssl/certs/p2p-chat.crt ]; then
    warning "SSL 证书已存在，跳过生成"
else
    openssl req -x509 -nodes -days 3650 -newkey rsa:2048 \
        -keyout /etc/ssl/private/p2p-chat.key \
        -out /etc/ssl/certs/p2p-chat.crt \
        -subj "/CN=$SERVER_IP" \
        -addext "subjectAltName=IP:$SERVER_IP" >> $LOG_FILE 2>&1
    chmod 600 /etc/ssl/private/p2p-chat.key
fi
check_command "SSL 证书生成"

# ========== 8. 配置 coturn ==========
info "[8/12] 配置 TURN 服务器..."
TURN_PASSWORD=$(openssl rand -base64 12)

cat > /etc/turnserver.conf << EOF
listening-port=3478
tls-listening-port=5349
listening-ip=0.0.0.0
external-ip=$SERVER_IP
min-port=49152
max-port=65535
realm=$SERVER_IP
user=webrtc:$TURN_PASSWORD
lt-cred-mech
fingerprint
no-cli
verbose
log-file=/var/log/turnserver/turnserver.log
EOF

mkdir -p /var/log/turnserver
chown turnserver:turnserver /var/log/turnserver 2>/dev/null || true

systemctl restart coturn >> $LOG_FILE 2>&1
systemctl enable coturn >> $LOG_FILE 2>&1
check_command "coturn 配置"

# ========== 9. 克隆代码 ==========
info "[9/12] 克隆项目代码..."
if [ -d "$APP_DIR" ]; then
    warning "目录已存在，正在更新..."
    cd $APP_DIR
    git fetch origin >> $LOG_FILE 2>&1
    git reset --hard origin/main >> $LOG_FILE 2>&1
else
    git clone $REPO_URL $APP_DIR >> $LOG_FILE 2>&1
fi
check_command "代码克隆/更新"

# ========== 10. 构建项目 ==========
info "[10/12] 构建前端和后端..."

# 创建前端环境配置
cd $APP_DIR/p2p-chat/client
cat > .env.production << EOF
VITE_STUN_URL=stun:$SERVER_IP:3478
VITE_TURN_URL=turn:$SERVER_IP:3478
VITE_TURN_USER=webrtc
VITE_TURN_PASS=$TURN_PASSWORD
EOF
success "前端环境配置已创建"

# 构建前端
info "    构建前端 (npm install)..."
npm install >> $LOG_FILE 2>&1
check_command "前端依赖安装"

info "    构建前端 (npm run build)..."
npm run build >> $LOG_FILE 2>&1
check_command "前端构建"

# 构建后端
cd $APP_DIR/p2p-chat/server
info "    构建后端 (npm install)..."
npm install >> $LOG_FILE 2>&1
check_command "后端依赖安装"

# 修复 node_modules/.bin 权限问题
chmod +x node_modules/.bin/* 2>/dev/null || true

info "    构建后端 (npm run build)..."
npm run build >> $LOG_FILE 2>&1
check_command "后端构建"

# ========== 11. 配置 Nginx ==========
info "[11/12] 配置 Nginx..."
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
        proxy_set_header X-Real-IP \$remote_addr;
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

# 测试 Nginx 配置
nginx -t >> $LOG_FILE 2>&1
check_command "Nginx 配置检查"

systemctl reload nginx >> $LOG_FILE 2>&1
check_command "Nginx 重启"

# ========== 12. 启动后端服务 ==========
info "[12/12] 启动后端服务..."
cd $APP_DIR/p2p-chat/server

# 停止旧进程
pm2 delete p2p-chat >> $LOG_FILE 2>&1 || true

# 启动新进程
pm2 start dist/index.js --name p2p-chat >> $LOG_FILE 2>&1
check_command "PM2 启动服务"

pm2 save >> $LOG_FILE 2>&1
pm2 startup systemd -u root --hp /root >> $LOG_FILE 2>&1 || true
success "PM2 开机自启已配置"

# ========== 配置防火墙 ==========
info "配置防火墙..."
ufw allow 22/tcp >> $LOG_FILE 2>&1
ufw allow 80/tcp >> $LOG_FILE 2>&1
ufw allow 443/tcp >> $LOG_FILE 2>&1
ufw allow 3478/tcp >> $LOG_FILE 2>&1
ufw allow 3478/udp >> $LOG_FILE 2>&1
ufw allow 5349/tcp >> $LOG_FILE 2>&1
ufw allow 5349/udp >> $LOG_FILE 2>&1
ufw allow 49152:65535/udp >> $LOG_FILE 2>&1
echo "y" | ufw enable >> $LOG_FILE 2>&1 || true
success "防火墙配置完成"

# ========== 部署完成 ==========
echo ""
echo "========================================================"
echo -e "${GREEN}🎉 部署完成！${NC}"
echo "========================================================"
echo ""
echo "📋 服务信息:"
echo "   访问地址: https://$SERVER_IP"
echo "   TURN 用户: webrtc"
echo "   TURN 密码: $TURN_PASSWORD"
echo ""
echo "⚠️  首次访问浏览器会提示'不安全'："
echo "   Chrome: 点击 '高级' -> '继续前往 $SERVER_IP'"
echo "   Safari: 点击 '显示详细信息' -> '访问此网站'"
echo ""
echo "📊 服务状态:"
pm2 status
echo ""
echo "📝 常用命令:"
echo "   查看日志: pm2 logs p2p-chat"
echo "   重启服务: pm2 restart p2p-chat"
echo "   查看部署日志: tail -100 $LOG_FILE"
echo ""
echo "🔧 服务检查:"
echo "   Nginx: systemctl status nginx"
echo "   coturn: systemctl status coturn"
echo "   后端: pm2 status"
echo ""

# 保存重要信息到文件
cat > /root/p2p-chat-info.txt << EOF
========== P2P Chat 部署信息 ==========
部署时间: $(date)
访问地址: https://$SERVER_IP
TURN 用户: webrtc
TURN 密码: $TURN_PASSWORD
日志文件: $LOG_FILE
========================================
EOF

success "部署信息已保存到: /root/p2p-chat-info.txt"
echo ""

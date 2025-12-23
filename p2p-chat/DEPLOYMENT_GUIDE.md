# 🚀 P2P Chat 项目部署完整指南

## 📋 项目架构

```
p2p-chat/
├── client/          # 前端 (Vue3 + Vite)
├── server/          # 信令服务器 (Node.js + Socket.io)
└── deploy/          # 部署脚本和配置
```

## 🎯 部署所需组件

### 1. **前端应用** (Client)
- Vue3 + Vite 构建
- 静态文件需要 Nginx 托管
- 需要 HTTPS（WebRTC 要求）

### 2. **信令服务器** (Server)
- Node.js + Socket.io
- 监听 3001 端口（内部）
- 通过 Nginx 反向代理暴露

### 3. **STUN/TURN 服务器** (Coturn)
- 用于 NAT 穿透
- 监听 3478 (STUN/TURN) 和 5349 (TURNS)
- 需要开放 UDP 端口范围 49152-65535

### 4. **Web 服务器** (Nginx)
- 提供 HTTPS
- 托管前端静态文件
- 反向代理 Socket.io 到信令服务器

## 📦 完整部署步骤

### 阶段一：服务器准备

#### 1.1 系统要求
- Ubuntu 24.04 LTS（推荐）
- 2GB+ 内存
- 1核+ CPU
- 公网 IP

#### 1.2 安装基础环境
```bash
# 更新系统
apt update && apt upgrade -y

# 安装基础工具
apt install -y git curl build-essential

# 安装 Node.js 20
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt install -y nodejs

# 验证安装
node -v  # 应该显示 v20.x.x
npm -v
```

#### 1.3 安装 PM2（进程管理）
```bash
npm install -g pm2
```

#### 1.4 安装 Nginx
```bash
apt install -y nginx
systemctl enable nginx
systemctl start nginx
```

#### 1.5 安装 Coturn（STUN/TURN 服务器）
```bash
apt install -y coturn
```

---

### 阶段二：获取代码

#### 2.1 克隆或上传代码
```bash
# 方式一：从 Git 克隆
git clone https://github.com/a994335223/zb.git /var/www/p2p-chat
cd /var/www/p2p-chat/p2p-chat

# 方式二：手动上传
# 将项目文件上传到 /var/www/p2p-chat/p2p-chat/
```

---

### 阶段三：配置 STUN/TURN 服务器

#### 3.1 配置 Coturn
```bash
# 编辑配置文件
nano /etc/turnserver.conf
```

配置内容（修改密码和 IP）：
```ini
listening-port=3478
tls-listening-port=5349
listening-ip=0.0.0.0
external-ip=173.208.218.151  # 你的服务器 IP
min-port=49152
max-port=65535
verbose
log-file=/var/log/turnserver/turnserver.log
realm=173.208.218.151
user=webrtc:YourSecurePassword123  # 修改密码！
lt-cred-mech
fingerprint
no-cli
```

#### 3.2 启动 Coturn
```bash
# 创建日志目录
mkdir -p /var/log/turnserver
chown turnserver:turnserver /var/log/turnserver

# 启用并启动
systemctl enable coturn
systemctl restart coturn
systemctl status coturn
```

---

### 阶段四：配置前端环境变量

#### 4.1 创建生产环境配置
```bash
cd /var/www/p2p-chat/p2p-chat/client
cp env.production.example .env.production
nano .env.production
```

配置内容：
```env
# STUN/TURN 服务器配置
VITE_STUN_URL=stun:173.208.218.151:3478
VITE_TURN_URL=turn:173.208.218.151:3478
VITE_TURN_USER=webrtc
VITE_TURN_PASS=YourSecurePassword123  # 与 coturn 配置一致

# Socket.io 服务器（可选，默认使用当前域名）
# VITE_SOCKET_URL=https://your-domain.com
```

---

### 阶段五：构建项目

#### 5.1 构建前端
```bash
cd /var/www/p2p-chat/p2p-chat/client
npm install
npm run build
# 构建产物在 client/dist/
```

#### 5.2 构建后端
```bash
cd /var/www/p2p-chat/p2p-chat/server
npm install
npm run build
# 构建产物在 server/dist/
```

---

### 阶段六：配置 Nginx

#### 6.1 创建 Nginx 配置

**方案 A：有域名（推荐）**
```bash
nano /etc/nginx/sites-available/p2p-chat
```

使用 `deploy/nginx.conf` 模板，修改：
- `server_name` 改为你的域名
- SSL 证书路径（使用 Let's Encrypt）

**方案 B：无域名（使用 IP）**
```bash
nano /etc/nginx/sites-available/p2p-chat
```

使用 `deploy/nginx-ip.conf` 模板，需要：
- 生成自签名证书（见下方）

#### 6.2 生成自签名证书（无域名时）
```bash
# 创建证书目录
mkdir -p /etc/ssl/certs /etc/ssl/private

# 生成证书
openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
  -keyout /etc/ssl/private/p2p-chat.key \
  -out /etc/ssl/certs/p2p-chat.crt \
  -subj "/C=CN/ST=State/L=City/O=Organization/CN=173.208.218.151"
```

#### 6.3 启用 Nginx 配置
```bash
# 创建软链接
ln -s /etc/nginx/sites-available/p2p-chat /etc/nginx/sites-enabled/

# 删除默认配置（可选）
rm /etc/nginx/sites-enabled/default

# 测试配置
nginx -t

# 重载配置
systemctl reload nginx
```

---

### 阶段七：启动信令服务器

#### 7.1 使用 PM2 启动
```bash
cd /var/www/p2p-chat/p2p-chat/server
pm2 start dist/index.js --name p2p-chat-server
pm2 save
pm2 startup  # 设置开机自启
```

#### 7.2 验证运行
```bash
pm2 status
pm2 logs p2p-chat-server

# 测试健康检查
curl http://localhost:3001/health
```

---

### 阶段八：配置防火墙

#### 8.1 开放必要端口
```bash
# 使用 UFW
ufw allow 22/tcp      # SSH
ufw allow 80/tcp      # HTTP
ufw allow 443/tcp     # HTTPS
ufw allow 3478/tcp    # STUN/TURN
ufw allow 3478/udp    # STUN/TURN
ufw allow 5349/tcp    # TURNS
ufw allow 5349/udp    # TURNS
ufw allow 49152:65535/udp  # WebRTC 媒体流
ufw enable
```

#### 8.2 验证端口监听
```bash
# 检查端口
ss -tlnp | grep -E "3001|3478|443|80"
```

---

### 阶段九：测试验证

#### 9.1 测试 STUN/TURN
```bash
# 安装测试工具
apt install -y coturn-utils

# 测试 STUN
turnutils_stunclient 173.208.218.151

# 测试 TURN
turnutils_uclient -T -u webrtc -w YourSecurePassword123 173.208.218.151
```

#### 9.2 在线测试
访问 [Trickle ICE](https://webrtc.github.io/samples/src/content/peerconnection/trickle-ice/)：
- STUN: `stun:173.208.218.151:3478`
- TURN: `turn:173.208.218.151:3478`
- 用户名: `webrtc`
- 密码: `YourSecurePassword123`

#### 9.3 访问应用
- 有域名: `https://your-domain.com`
- 无域名: `https://173.208.218.151`（需要信任自签名证书）

---

## 🔄 更新部署

```bash
cd /var/www/p2p-chat
git pull origin main  # 或手动上传新代码

# 重新构建
cd p2p-chat/client && npm run build
cd ../server && npm run build

# 重启服务
pm2 restart p2p-chat-server
systemctl reload nginx
```

---

## 📊 监控和维护

### 查看日志
```bash
# PM2 日志
pm2 logs p2p-chat-server

# Nginx 日志
tail -f /var/log/nginx/access.log
tail -f /var/log/nginx/error.log

# Coturn 日志
tail -f /var/log/turnserver/turnserver.log
```

### 服务状态
```bash
# 检查所有服务
pm2 status
systemctl status nginx
systemctl status coturn
```

---

## ⚠️ 常见问题

### 1. WebRTC 连接失败
- 检查防火墙端口是否开放
- 检查 Coturn 是否运行
- 检查浏览器控制台的 ICE 候选信息

### 2. Socket.io 连接失败
- 检查 Nginx 配置中的 `/socket.io/` 代理
- 检查信令服务器是否运行在 3001 端口
- 检查浏览器控制台的网络请求

### 3. HTTPS 证书问题
- 有域名：使用 Let's Encrypt
- 无域名：使用自签名证书（浏览器会警告）

### 4. 视频卡顿
- 检查服务器带宽
- 检查是否使用了 TURN 中继（会增加延迟）
- 检查网络质量

---

## 🎯 一键部署脚本

项目提供了自动化部署脚本：

```bash
cd /var/www/p2p-chat/p2p-chat/deploy
chmod +x full-deploy.sh
./full-deploy.sh
```

脚本会自动完成所有部署步骤。

---

## 📝 部署检查清单

- [ ] Node.js 20 已安装
- [ ] Nginx 已安装并运行
- [ ] Coturn 已配置并运行
- [ ] 前端环境变量已配置
- [ ] 前端已构建（client/dist/）
- [ ] 后端已构建（server/dist/）
- [ ] Nginx 配置已启用
- [ ] SSL 证书已配置
- [ ] 信令服务器已启动（PM2）
- [ ] 防火墙端口已开放
- [ ] STUN/TURN 测试通过
- [ ] 应用可以访问

---

## 🔐 安全建议

1. **修改默认密码**：Coturn 用户名密码
2. **使用强密码**：至少 16 位，包含大小写字母、数字、特殊字符
3. **定期更新**：系统、Node.js、依赖包
4. **限制访问**：使用防火墙限制不必要的端口
5. **使用域名**：避免自签名证书的安全警告
6. **启用日志**：监控异常访问


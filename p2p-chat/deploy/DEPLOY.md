# 🚀 P2P Chat 部署指南

## 📋 服务器要求

- **操作系统**: Ubuntu 24.04 LTS
- **内存**: 最低 2GB（推荐 4GB）
- **CPU**: 1核+ 
- **带宽**: 取决于用户数量
- **公网IP**: 必须

---

## 🔴 重要：是否需要域名？

### 方案一：有域名（推荐 ✅）
- 使用 Let's Encrypt 免费 SSL 证书
- 支持 HTTPS，WebRTC 正常工作
- 用户体验好

### 方案二：无域名（仅测试用）
- 可以使用自签名证书
- 浏览器会显示安全警告
- 需要用户手动信任证书

---

## 📦 部署步骤

### 第一步：安装基础环境

```bash
# SSH 登录服务器
ssh root@173.208.218.151

# 上传部署脚本（或直接克隆仓库）
git clone https://github.com/a994335223/zb.git /var/www/p2p-chat
cd /var/www/p2p-chat/p2p-chat/deploy

# 执行安装脚本
chmod +x install.sh
./install.sh
```

### 第二步：配置域名（如果有）

1. 在域名服务商处添加 A 记录：
   ```
   类型: A
   名称: @ 或 chat
   值: 173.208.218.151
   ```

2. 获取 SSL 证书：
   ```bash
   certbot --nginx -d your-domain.com
   ```

### 第三步：配置 coturn

```bash
# 编辑 coturn 配置
nano /etc/turnserver.conf

# 复制以下内容（修改密码！）：
```

```ini
listening-port=3478
tls-listening-port=5349
listening-ip=173.208.218.151
external-ip=173.208.218.151
min-port=49152
max-port=65535
verbose
log-file=/var/log/turnserver/turnserver.log
realm=173.208.218.151
user=webrtc:YourSecurePassword123
lt-cred-mech
fingerprint
no-cli
```

```bash
# 创建日志目录
mkdir -p /var/log/turnserver
chown turnserver:turnserver /var/log/turnserver

# 重启 coturn
systemctl restart coturn
systemctl enable coturn

# 验证运行
systemctl status coturn
```

### 第四步：配置 Nginx

```bash
# 创建配置
nano /etc/nginx/sites-available/p2p-chat
```

复制 `nginx.conf` 内容，修改：
- `server_name` 改为你的域名
- SSL 证书路径

```bash
# 启用配置
ln -s /etc/nginx/sites-available/p2p-chat /etc/nginx/sites-enabled/
rm /etc/nginx/sites-enabled/default  # 删除默认配置

# 测试并重启
nginx -t
systemctl reload nginx
```

### 第五步：配置前端环境变量

```bash
cd /var/www/p2p-chat/p2p-chat/client

# 创建生产环境配置
cp env.production.example .env.production
nano .env.production
```

修改内容：
```env
VITE_STUN_URL=stun:173.208.218.151:3478
VITE_TURN_URL=turn:173.208.218.151:3478
VITE_TURN_USER=webrtc
VITE_TURN_PASS=YourSecurePassword123
```

### 第六步：构建和部署

```bash
# 构建前端
cd /var/www/p2p-chat/p2p-chat/client
npm install
npm run build

# 构建后端
cd /var/www/p2p-chat/p2p-chat/server
npm install
npm run build

# 使用 PM2 启动后端
pm2 start dist/index.js --name p2p-chat-server
pm2 save
pm2 startup
```

---

## 🔥 防火墙端口

| 端口 | 协议 | 用途 |
|------|------|------|
| 22 | TCP | SSH |
| 80 | TCP | HTTP（重定向到 HTTPS） |
| 443 | TCP | HTTPS |
| 3478 | TCP/UDP | STUN/TURN |
| 5349 | TCP/UDP | TURNS (TLS) |
| 49152-65535 | UDP | WebRTC 媒体流 |

```bash
# UFW 配置
ufw allow 22/tcp
ufw allow 80/tcp
ufw allow 443/tcp
ufw allow 3478/tcp
ufw allow 3478/udp
ufw allow 5349/tcp
ufw allow 5349/udp
ufw allow 49152:65535/udp
ufw enable
```

---

## 🧪 测试验证

### 1. 测试 STUN/TURN 服务器

```bash
# 安装测试工具
apt install -y coturn-utils

# 测试 STUN
turnutils_stunclient 173.208.218.151

# 测试 TURN
turnutils_uclient -T -u webrtc -w YourSecurePassword123 173.208.218.151
```

### 2. 在线测试工具

访问 [Trickle ICE](https://webrtc.github.io/samples/src/content/peerconnection/trickle-ice/) 测试：

1. 添加 STUN 服务器: `stun:173.208.218.151:3478`
2. 添加 TURN 服务器: `turn:173.208.218.151:3478`
3. 填入用户名和密码
4. 点击 "Gather candidates"
5. 应该看到 `srflx` 和 `relay` 类型的候选

### 3. 访问应用

打开 `https://your-domain.com`，测试：
- 创建房间
- 另一设备加入
- 测试视频、音频、文字消息

---

## 📊 监控和日志

```bash
# 查看 PM2 状态
pm2 status
pm2 logs p2p-chat-server

# 查看 Nginx 日志
tail -f /var/log/nginx/access.log
tail -f /var/log/nginx/error.log

# 查看 coturn 日志
tail -f /var/log/turnserver/turnserver.log
```

---

## ❓ 常见问题

### Q: WebRTC 连接失败？
A: 检查：
1. 防火墙端口是否开放
2. coturn 是否正常运行
3. 浏览器控制台的 ICE 候选信息

### Q: 没有域名怎么办？
A: 可以使用自签名证书：
```bash
openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
  -keyout /etc/ssl/private/selfsigned.key \
  -out /etc/ssl/certs/selfsigned.crt
```
然后在 Nginx 配置中使用这些证书。

### Q: 视频卡顿？
A: 检查：
1. 服务器带宽
2. 用户网络质量
3. 是否使用了 TURN 中继（增加延迟）

---

## 🔄 更新部署

```bash
cd /var/www/p2p-chat
git pull origin main

# 重新构建
cd p2p-chat/client && npm run build
cd ../server && npm run build

# 重启服务
pm2 restart p2p-chat-server
```


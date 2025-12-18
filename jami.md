# Jami 部署指南 - 中国快速部署方案

> 🔒 Jami 是一款开源、去中心化的即时通讯软件，支持语音/视频通话、群聊、文件传输，无需中央服务器。

---

## 📋 目录

1. [架构说明](#架构说明)
2. [快速开始 - 客户端安装](#快速开始---客户端安装)
3. [私有化部署方案](#私有化部署方案)
4. [TURN/STUN 服务器部署](#turnstun-服务器部署)
5. [Web 客户端部署](#web-客户端部署)
6. [企业版 JAMS 部署](#企业版-jams-部署)
7. [中国网络环境优化](#中国网络环境优化)
8. [常见问题](#常见问题)

---

## 架构说明

```
┌─────────────────────────────────────────────────────────────────┐
│                        Jami 去中心化架构                          │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│    ┌──────────┐         DHT 网络          ┌──────────┐         │
│    │  用户 A  │◄─────────────────────────►│  用户 B  │         │
│    │  (手机)  │     点对点加密通信          │  (电脑)  │         │
│    └──────────┘                           └──────────┘         │
│         │                                       │               │
│         │         ┌─────────────────┐          │               │
│         └────────►│  DHT Bootstrap  │◄─────────┘               │
│                   │     Nodes       │                           │
│                   │  (用户发现节点)  │                           │
│                   └─────────────────┘                           │
│                            │                                    │
│                   ┌────────┴────────┐                          │
│                   ▼                  ▼                          │
│           ┌─────────────┐    ┌─────────────┐                   │
│           │ TURN Server │    │ STUN Server │                   │
│           │ (可选-NAT穿透)│    │ (可选-NAT穿透)│                   │
│           └─────────────┘    └─────────────┘                   │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### 核心特点

| 特性 | 说明 |
|------|------|
| 🔐 端到端加密 | 所有通信内容加密，服务器无法读取 |
| 🌐 去中心化 | 无需中央服务器，基于 DHT 分布式网络 |
| 📱 多平台 | Windows、macOS、Linux、Android、iOS |
| 👥 群组支持 | 支持群聊、群语音、群视频 |
| 🆓 完全免费 | GPL 开源协议，永久免费 |

---

## 快速开始 - 客户端安装

### Windows 安装

```powershell
# 方法1：直接下载安装包
# 访问 https://jami.net/download/ 下载 MSI 安装包

# 方法2：使用 winget（Windows 11）
winget install SasaiSasai.Jami

# 方法3：使用 Chocolatey
choco install jami
```

### macOS 安装

```bash
# 方法1：直接下载
# 访问 https://jami.net/download/ 下载 DMG 安装包

# 方法2：使用 Homebrew
brew install --cask jami
```

### Linux 安装

```bash
# Ubuntu / Debian
sudo apt install gnupg dirmngr ca-certificates curl
curl -s https://dl.jami.net/public-key.gpg | sudo tee /usr/share/keyrings/jami-archive-keyring.gpg > /dev/null
echo "deb [signed-by=/usr/share/keyrings/jami-archive-keyring.gpg] https://dl.jami.net/nightly/ubuntu_22.04/ jami main" | sudo tee /etc/apt/sources.list.d/jami.list
sudo apt update && sudo apt install jami

# Fedora
sudo dnf install jami

# Arch Linux
yay -S jami

# 通用 - Flatpak
flatpak install flathub net.jami.Jami
flatpak run net.jami.Jami
```

### Android 安装

| 来源 | 链接 |
|------|------|
| Google Play | https://play.google.com/store/apps/details?id=cx.ring |
| F-Droid | https://f-droid.org/packages/cx.ring/ |
| APK 直接下载 | https://jami.net/download/ |

> ⚠️ **中国用户建议**：使用 F-Droid 或直接下载 APK，避免 Google Play 访问问题

### iOS 安装

| 来源 | 链接 |
|------|------|
| App Store | https://apps.apple.com/app/jami/id1306951055 |

---

## 私有化部署方案

如果你希望完全控制 Jami 网络，可以部署私有基础设施：

### 方案一：仅使用公共网络（最简单）

```
✅ 优点：零配置，直接使用
❌ 缺点：依赖公共 DHT 节点，可能有延迟
```

直接安装客户端即可使用，Jami 会自动连接公共 DHT 引导节点。

### 方案二：自建 TURN/STUN 服务器（推荐）

适合企业内网或网络环境复杂的场景。

### 方案三：完全私有网络

部署私有 DHT 引导节点 + TURN/STUN 服务器 + JAMS 账户管理。

---

## TURN/STUN 服务器部署

> 💡 TURN/STUN 服务器用于帮助 NAT 穿透，提高连接成功率

### 使用 Docker 部署 coturn

**1. 创建配置文件**

```bash
mkdir -p /etc/coturn
```

创建 `/etc/coturn/turnserver.conf`:

```ini
# TURN 服务器配置
listening-port=3478
tls-listening-port=5349

# 外部 IP（替换为你的服务器公网 IP）
external-ip=YOUR_PUBLIC_IP

# 域名（替换为你的域名）
realm=turn.yourdomain.com

# 认证
lt-cred-mech
user=jami:your_secure_password

# 日志
log-file=/var/log/turnserver.log
verbose

# 安全设置
no-multicast-peers
no-cli
no-loopback-peers

# 中继端口范围
min-port=49152
max-port=65535

# 指纹
fingerprint
```

**2. Docker Compose 部署**

创建 `docker-compose-turn.yml`:

```yaml
version: '3.8'

services:
  coturn:
    image: coturn/coturn:latest
    container_name: jami-turn
    restart: unless-stopped
    network_mode: host
    volumes:
      - /etc/coturn/turnserver.conf:/etc/coturn/turnserver.conf:ro
      - /var/log/coturn:/var/log
    command: -c /etc/coturn/turnserver.conf
```

**3. 启动服务**

```bash
docker-compose -f docker-compose-turn.yml up -d
```

**4. 防火墙配置**

```bash
# Ubuntu/Debian
sudo ufw allow 3478/tcp
sudo ufw allow 3478/udp
sudo ufw allow 5349/tcp
sudo ufw allow 5349/udp
sudo ufw allow 49152:65535/udp

# CentOS/RHEL
sudo firewall-cmd --permanent --add-port=3478/tcp
sudo firewall-cmd --permanent --add-port=3478/udp
sudo firewall-cmd --permanent --add-port=5349/tcp
sudo firewall-cmd --permanent --add-port=5349/udp
sudo firewall-cmd --permanent --add-port=49152-65535/udp
sudo firewall-cmd --reload
```

**5. 在 Jami 客户端配置 TURN**

```
设置 → 账户 → 高级设置 → TURN 服务器
地址: turn:turn.yourdomain.com:3478
用户名: jami
密码: your_secure_password
```

---

## Web 客户端部署

> ✅ **好消息**：Jami 官方 Web 客户端（jami-web）已经开发完成，可以部署使用！

### 项目信息

| 项目 | 信息 |
|------|------|
| 仓库地址 | https://git.jami.net/savoirfairelinux/jami-web |
| 技术栈 | React (TSX) + TypeScript + Express.js + Node.js |
| 许可证 | GPL v3.0 |
| 提交数 | 703+ commits |
| 状态 | ✅ 可用 |

### 项目结构

```
jami-web/
├── client/     # React 前端
├── server/     # Express.js 后端（启动 daemon 实例）
├── common/     # 共享代码
└── daemon/     # Jami daemon 子模块
```

---

### 方案一：Docker Compose 快速部署（推荐）⭐

这是最简单的部署方式，适合生产环境。

**1. 克隆仓库**

```bash
git clone https://git.jami.net/savoirfairelinux/jami-web.git
cd jami-web
git submodule update --init --recursive
```

**2. 生产环境部署**

```bash
# 一键启动
docker compose up --build -d
```

**3. 访问应用**

```
http://你的服务器IP:8080
```

---

### 方案二：Docker 手动部署

如果你需要更多控制，可以手动构建 Docker 镜像。

**1. 克隆仓库并初始化子模块**

```bash
git clone https://git.jami.net/savoirfairelinux/jami-web.git
cd jami-web
git submodule update --init --recursive
```

**2. 构建 daemon Docker 镜像**

```bash
cd daemon
docker build --build-arg cmake_args=-DJAMI_NODEJS=ON -t jami-daemon .
cd ..
```

> 💡 如果遇到错误 `ERROR [internal] load metadata for docker.io/library/ubuntu:22.04`，
> 打开 `~/.docker/config.json` 删除 `"credsStore": "desktop"` 这一行。

**3. 构建 jami-web Docker 镜像**

```bash
# 生产环境
docker build --target production -t jami-web .
```

**4. 运行容器**

```bash
docker run -d \
    --name jami-web \
    --restart unless-stopped \
    -p 8080:8080 \
    jami-web
```

**5. 访问应用**

```
http://你的服务器IP:8080
```

---

### 方案三：本地源码编译部署

适合开发环境或需要深度定制的场景。

**前置要求**

- Linux 系统
- Node.js 22
- npm
- SWIG 4.1.0

**1. 安装系统依赖（Ubuntu）**

```bash
# 安装 daemon 编译依赖
sudo apt install autoconf automake autopoint bison build-essential cmake curl git \
    libarchive-dev libasio-dev libasound2-dev libdbus-1-dev libdbus-c++-dev \
    libexpat1-dev libfmt-dev libgmp-dev nettle-dev libgnutls28-dev libjsoncpp-dev \
    libmsgpack-dev libnatpmp-dev libopus-dev libpulse-dev libspeex-dev libspeexdsp-dev \
    libssl-dev libtool libudev-dev libupnp-dev libva-dev libvdpau-dev libvpx-dev \
    libx264-dev libyaml-cpp-dev libhttp-parser-dev libwebrtc-audio-processing-dev \
    libsecp256k1-dev guile-3.0-dev nasm pkg-config yasm libpipewire-0.3-dev libsystemd-dev

# 安装 Bison（编译 SWIG 需要）
sudo apt install bison
```

**2. 安装 SWIG 4.1.0**

```bash
git clone https://github.com/swig/swig.git
cd swig
./autogen.sh
./configure
make
sudo make install
cd ..
```

**3. 克隆仓库**

```bash
git clone https://git.jami.net/savoirfairelinux/jami-web.git
cd jami-web
git submodule update --init --recursive
```

**4. 编译 daemon 依赖**

```bash
cd daemon/contrib
mkdir native && cd native
../bootstrap
make -j$(nproc)
cd ../../..
```

**5. 安装 node-gyp 并编译 daemon**

```bash
npm install -g node-gyp

cd daemon
mkdir build && cd build
cmake .. -DJAMI_NODEJS=On -DBUILD_TESTING=Off
make -j$(nproc)
cd ../..
```

**6. 创建符号链接**

```bash
cd server
ln -s ../daemon/bin/nodejs/build/Release/jamid.node jamid.node
cd ..
```

**7. 安装 npm 依赖**

```bash
npm install
```

**8. 配置环境变量**

创建 `server/.env` 文件：

```ini
NODE_ENV=production
```

**9. 构建生产版本**

```bash
npm run build
```

**10. 运行生产服务**

```bash
LD_LIBRARY_PATH="${PWD}/daemon/src/.libs" npm run start:prod
```

**11. 访问应用**

```
http://localhost:3000
```

---

### 开发环境运行

如果你需要进行开发调试：

**使用 Docker Compose（推荐）**

```bash
docker-compose -f docker-compose.dev.yml up
```

**手动运行**

```bash
# 设置 server/.env
# NODE_ENV=development

# 启动开发服务器（支持热重载）
LD_LIBRARY_PATH="${PWD}/daemon/src/.libs" npm start
```

访问 http://localhost:3000 查看应用。

---

### Docker Compose 完整配置示例

创建 `docker-compose.yml`：

```yaml
version: '3.8'

services:
  jami-web:
    build:
      context: .
      target: production
    container_name: jami-web
    restart: unless-stopped
    ports:
      - "8080:8080"
    volumes:
      - jami-data:/root/.local/share/jami
    environment:
      - NODE_ENV=production

volumes:
  jami-data:
```

---

### Nginx 反向代理配置

如果你需要通过域名访问并启用 HTTPS：

```nginx
server {
    listen 80;
    server_name jami.yourdomain.com;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name jami.yourdomain.com;

    ssl_certificate /etc/letsencrypt/live/jami.yourdomain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/jami.yourdomain.com/privkey.pem;

    location / {
        proxy_pass http://127.0.0.1:8080;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        
        # WebSocket 支持
        proxy_read_timeout 86400;
    }
}
```

---

## 企业版 JAMS 部署

> JAMS (Jami Account Management Server) 是 Jami 的企业账户管理解决方案

### JAMS 功能

- 📋 集中账户管理
- 👥 用户目录服务
- 🔐 企业级身份验证
- 📊 使用统计和审计

### Docker 部署 JAMS

**1. 创建 docker-compose-jams.yml**

```yaml
version: '3.8'

services:
  jams:
    image: savoirfairelinux/jams:latest
    container_name: jams
    restart: unless-stopped
    ports:
      - "8080:8080"
      - "8443:8443"
    volumes:
      - jams-data:/var/lib/jams
      - ./jams-config:/etc/jams
    environment:
      - JAMS_ADMIN_PASSWORD=your_admin_password
      - JAMS_DOMAIN=jams.yourdomain.com

volumes:
  jams-data:
```

**2. 启动 JAMS**

```bash
docker-compose -f docker-compose-jams.yml up -d
```

**3. 访问管理界面**

```
https://jams.yourdomain.com:8443/admin
用户名: admin
密码: your_admin_password
```

**4. 客户端配置 JAMS**

```
设置 → 账户 → 账户管理服务器
URL: https://jams.yourdomain.com:8443
```

> 💰 **注意**：JAMS 完整功能可能需要企业许可证，基础功能免费

---

## 中国网络环境优化

### 1. 推荐服务器位置

| 优先级 | 位置 | 说明 |
|--------|------|------|
| 1 | 香港 | 延迟最低，网络稳定 |
| 2 | 新加坡 | 备选方案 |
| 3 | 国内云 | 需备案，仅内网使用 |

### 2. 网络配置建议

```bash
# 服务器端优化 - /etc/sysctl.conf
net.core.rmem_max = 16777216
net.core.wmem_max = 16777216
net.ipv4.tcp_rmem = 4096 87380 16777216
net.ipv4.tcp_wmem = 4096 65536 16777216
net.ipv4.tcp_congestion_control = bbr

# 应用配置
sudo sysctl -p
```

### 3. 防火墙端口清单

| 端口 | 协议 | 用途 |
|------|------|------|
| 3478 | TCP/UDP | TURN/STUN |
| 5349 | TCP/UDP | TURN TLS |
| 5060-5061 | TCP/UDP | SIP (可选) |
| 49152-65535 | UDP | 媒体中继 |

### 4. 客户端优化设置

在 Jami 客户端中：

```
设置 → 账户 → 高级设置

✅ 启用 TURN
✅ 启用 STUN  
✅ 启用 UPnP
✅ 启用 DHT 代理（网络受限时）
```

---

## 一键部署脚本

创建 `deploy-jami.sh`:

```bash
#!/bin/bash

# Jami 基础设施一键部署脚本
# 适用于 Ubuntu 22.04+

set -e

echo "========================================="
echo "  Jami 基础设施部署脚本"
echo "========================================="

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

# 检查 root 权限
if [ "$EUID" -ne 0 ]; then
    echo -e "${RED}请使用 root 权限运行此脚本${NC}"
    exit 1
fi

# 获取公网 IP
PUBLIC_IP=$(curl -s ifconfig.me)
echo -e "${GREEN}检测到公网 IP: $PUBLIC_IP${NC}"

# 安装 Docker
install_docker() {
    echo -e "${YELLOW}正在安装 Docker...${NC}"
    curl -fsSL https://get.docker.com | sh
    systemctl enable docker
    systemctl start docker
    
    # 安装 docker-compose
    curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
    chmod +x /usr/local/bin/docker-compose
    echo -e "${GREEN}Docker 安装完成${NC}"
}

# 部署 TURN 服务器
deploy_turn() {
    echo -e "${YELLOW}正在部署 TURN 服务器...${NC}"
    
    mkdir -p /etc/coturn /var/log/coturn
    
    # 生成随机密码
    TURN_PASSWORD=$(openssl rand -base64 16)
    
    cat > /etc/coturn/turnserver.conf << EOF
listening-port=3478
tls-listening-port=5349
external-ip=$PUBLIC_IP
realm=turn.local
lt-cred-mech
user=jami:$TURN_PASSWORD
log-file=/var/log/coturn/turnserver.log
verbose
no-multicast-peers
no-cli
min-port=49152
max-port=65535
fingerprint
EOF
    
    # Docker 运行 coturn
    docker run -d \
        --name jami-turn \
        --restart unless-stopped \
        --network host \
        -v /etc/coturn/turnserver.conf:/etc/coturn/turnserver.conf:ro \
        -v /var/log/coturn:/var/log \
        coturn/coturn:latest \
        -c /etc/coturn/turnserver.conf
    
    echo -e "${GREEN}TURN 服务器部署完成${NC}"
    echo -e "${GREEN}TURN 地址: turn:$PUBLIC_IP:3478${NC}"
    echo -e "${GREEN}用户名: jami${NC}"
    echo -e "${GREEN}密码: $TURN_PASSWORD${NC}"
    
    # 保存配置
    echo "TURN_SERVER=turn:$PUBLIC_IP:3478" >> /root/jami-config.env
    echo "TURN_USER=jami" >> /root/jami-config.env
    echo "TURN_PASSWORD=$TURN_PASSWORD" >> /root/jami-config.env
}

# 配置防火墙
configure_firewall() {
    echo -e "${YELLOW}配置防火墙...${NC}"
    
    if command -v ufw &> /dev/null; then
        ufw allow 3478/tcp
        ufw allow 3478/udp
        ufw allow 5349/tcp
        ufw allow 5349/udp
        ufw allow 49152:65535/udp
    elif command -v firewall-cmd &> /dev/null; then
        firewall-cmd --permanent --add-port=3478/tcp
        firewall-cmd --permanent --add-port=3478/udp
        firewall-cmd --permanent --add-port=5349/tcp
        firewall-cmd --permanent --add-port=5349/udp
        firewall-cmd --permanent --add-port=49152-65535/udp
        firewall-cmd --reload
    fi
    
    echo -e "${GREEN}防火墙配置完成${NC}"
}

# 主菜单
main_menu() {
    echo ""
    echo "请选择要部署的组件："
    echo "1) 安装 Docker"
    echo "2) 部署 TURN 服务器"
    echo "3) 配置防火墙"
    echo "4) 全部安装"
    echo "5) 退出"
    echo ""
    read -p "请输入选项 [1-5]: " choice
    
    case $choice in
        1) install_docker ;;
        2) deploy_turn ;;
        3) configure_firewall ;;
        4)
            install_docker
            deploy_turn
            configure_firewall
            echo -e "${GREEN}=========================================${NC}"
            echo -e "${GREEN}  部署完成！${NC}"
            echo -e "${GREEN}  配置信息已保存到 /root/jami-config.env${NC}"
            echo -e "${GREEN}=========================================${NC}"
            ;;
        5) exit 0 ;;
        *) echo -e "${RED}无效选项${NC}" ;;
    esac
}

main_menu
```

使用方法：

```bash
chmod +x deploy-jami.sh
sudo ./deploy-jami.sh
```

---

## 常见问题

### Q1: 无法连接到其他用户

**解决方案**：
1. 检查防火墙设置
2. 启用 TURN 服务器
3. 检查网络是否限制 P2P 连接

### Q2: 视频/语音质量差

**解决方案**：
1. 使用更近的 TURN 服务器
2. 检查网络带宽
3. 降低视频质量设置

### Q3: 账户无法同步到其他设备

**解决方案**：
1. 确保两个设备在同一网络
2. 使用账户备份/恢复功能
3. 使用设备链接码

### Q4: 中国无法访问 DHT 网络

**解决方案**：
1. 部署私有 DHT 引导节点
2. 使用 DHT 代理功能
3. 部署在香港/新加坡服务器

---

## 相关链接

| 资源 | 链接 |
|------|------|
| 官方网站 | https://jami.net |
| 官方文档 | https://docs.jami.net/zh_CN/ |
| 源代码 | https://git.jami.net/savoirfairelinux |
| 下载页面 | https://jami.net/download/ |
| F-Droid | https://f-droid.org/packages/cx.ring/ |

---

## 版本信息

- 文档版本：1.0
- 更新日期：2024-12
- 适用 Jami 版本：Latest

---

> 📝 **提示**：如果你只是想快速体验 Jami，直接下载客户端安装即可，无需部署任何服务器。Jami 会自动使用公共网络进行通信。


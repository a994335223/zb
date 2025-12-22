root@vps-btar:/var/www/p2p-chat/p2p-chat/deploy# tail -30 /var/log/p2p-chat-deploy.log
Executing: /usr/lib/systemd/systemd-sysv-install enable coturn
2025-12-22 10:22:05 [SUCCESS] ✅ coturn 配置
2025-12-22 10:22:05 [INFO] [9/12] 克隆项目代码...
2025-12-22 10:22:05 [WARNING] ⚠️ 目录已存在，正在更新...
HEAD is now at 548c449 fix tsconfig
2025-12-22 10:22:05 [SUCCESS] ✅ 代码克隆/更新
2025-12-22 10:22:05 [INFO] [10/12] 构建前端和后端...
2025-12-22 10:22:05 [SUCCESS] ✅ 前端环境配置已创建
2025-12-22 10:22:05 [INFO]     构建前端 (npm install)...

up to date, audited 158 packages in 1s

46 packages are looking for funding
  run `npm fund` for details

found 0 vulnerabilities
2025-12-22 10:22:07 [SUCCESS] ✅ 前端依赖安装
2025-12-22 10:22:07 [INFO]     构建前端 (npm run build)...

> client@0.0.0 build
> tsc && vite build

src/composables/useWebRTC.ts(309,11): error TS2322: Type 'string' is not assignable to type 'number'.
src/composables/useWebRTC.ts(309,33): error TS2349: This expression is not callable.
  Type 'Number' has no call signatures.
src/composables/useWebRTC.ts(310,40): error TS2349: This expression is not callable.
  Type 'String' has no call signatures.
2025-12-22 10:22:11 [ERROR] ❌ 脚本在第 194 行出错，退出码: 2
2025-12-22 10:22:11 [ERROR] ❌ 请查看日志文件: /var/log/p2p-chat-deploy.log
2025-12-22 10:22:11 [ERROR] ❌ 或运行: tail -100 /var/log/p2p-chat-deploy.log
root@vps-btar:/var/www/p2p-chat/p2p-chat/deploy# cd /var/www/p2p-chat && git log --oneline -3
548c449 (HEAD -> main, origin/main, origin/HEAD) fix tsconfig
057b8b7 鏀硅繘閮ㄧ讲鑴氭湰锛氭坊鍔犺缁嗘棩蹇楀拰閿欒澶勭悊
7d98923 修复聊天p2p
root@vps-btar:/var/www/p2p-chat# 
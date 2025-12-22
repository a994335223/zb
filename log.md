root@vps-btar:/var/www/p2p-chat/p2p-chat/deploy# tail -20 /var/log/p2p-chat-deploy.log
✓ built in 4.49s
2025-12-22 10:32:23 [SUCCESS] ✅ 前端构建
2025-12-22 10:32:23 [INFO]     构建后端 (npm install)...

up to date, audited 145 packages in 1s

26 packages are looking for funding
  run `npm fund` for details

found 0 vulnerabilities
2025-12-22 10:32:24 [SUCCESS] ✅ 后端依赖安装
2025-12-22 10:32:24 [INFO]     构建后端 (npm run build)...

> p2p-chat-server@1.0.0 build
> npx tsc

sh: 1: tsc: Permission denied
2025-12-22 10:32:25 [ERROR] ❌ 脚本在第 204 行出错，退出码: 127
2025-12-22 10:32:25 [ERROR] ❌ 请查看日志文件: /var/log/p2p-chat-deploy.log
2025-12-22 10:32:25 [ERROR] ❌ 或运行: tail -100 /var/log/p2p-chat-deploy.log
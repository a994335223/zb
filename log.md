root@vps-btar:/var/www/p2p-chat/p2p-chat/deploy# tail -50 /var/log/p2p-chat-deploy.log
...+...+.....+++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++*.+......+...+..+...+...+...+.+......+.........+...+.....+.+.....+......+++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++*.........+..+.......+.....+...+++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++
-----
2025-12-22 10:08:48 [SUCCESS] ✅ SSL 证书生成
2025-12-22 10:08:48 [INFO] [8/12] 配置 TURN 服务器...
Synchronizing state of coturn.service with SysV service script with /usr/lib/systemd/systemd-sysv-install.
Executing: /usr/lib/systemd/systemd-sysv-install enable coturn
2025-12-22 10:08:50 [SUCCESS] ✅ coturn 配置
2025-12-22 10:08:50 [INFO] [9/12] 克隆项目代码...
2025-12-22 10:08:50 [WARNING] ⚠️ 目录已存在，正在更新...
HEAD is now at 057b8b7 鏀硅繘閮ㄧ讲鑴氭湰锛氭坊鍔犺缁嗘棩蹇楀拰閿欒澶勭悊
2025-12-22 10:08:51 [SUCCESS] ✅ 代码克隆/更新
2025-12-22 10:08:51 [INFO] [10/12] 构建前端和后端...
2025-12-22 10:08:51 [SUCCESS] ✅ 前端环境配置已创建
2025-12-22 10:08:51 [INFO]     构建前端 (npm install)...

added 157 packages, and audited 158 packages in 6s

46 packages are looking for funding
  run `npm fund` for details

found 0 vulnerabilities
2025-12-22 10:08:57 [SUCCESS] ✅ 前端依赖安装
2025-12-22 10:08:57 [INFO]     构建前端 (npm run build)...

> client@0.0.0 build
> tsc && vite build

src/composables/useWebRTC.ts(2,32): error TS2307: Cannot find module '@/stores/socket' or its corresponding type declarations.
src/composables/useWebRTC.ts(3,27): error TS2307: Cannot find module '@/config/ice' or its corresponding type declarations.
src/composables/useWebRTC.ts(4,77): error TS2307: Cannot find module '@/types' or its corresponding type declarations.
src/composables/useWebRTC.ts(83,11): error TS6133: 'activeCandidatePairId' is declared but its value is never read.
src/composables/useWebRTC.ts(309,11): error TS2322: Type 'string' is not assignable to type 'number'.
src/composables/useWebRTC.ts(309,33): error TS2349: This expression is not callable.
  Type 'Number' has no call signatures.
src/composables/useWebRTC.ts(310,40): error TS2349: This expression is not callable.
  Type 'String' has no call signatures.
src/composables/useWebRTC.ts(735,33): error TS7031: Binding element 'userId' implicitly has an 'any' type.
src/composables/useWebRTC.ts(735,41): error TS7031: Binding element 'userInfo' implicitly has an 'any' type.
src/composables/useWebRTC.ts(740,31): error TS7031: Binding element 'userId' implicitly has an 'any' type.
src/composables/useWebRTC.ts(745,28): error TS7031: Binding element 'from' implicitly has an 'any' type.
src/composables/useWebRTC.ts(745,34): error TS7031: Binding element 'payload' implicitly has an 'any' type.
src/composables/useWebRTC.ts(745,43): error TS7031: Binding element 'type' implicitly has an 'any' type.
src/composables/useWebRTC.ts(761,32): error TS7031: Binding element 'users' implicitly has an 'any' type.
src/composables/useWebRTC.ts(770,38): error TS7031: Binding element 'userId' implicitly has an 'any' type.
src/composables/useWebRTC.ts(770,46): error TS7031: Binding element 'isAudioEnabled' implicitly has an 'any' type.
src/composables/useWebRTC.ts(770,62): error TS7031: Binding element 'isVideoEnabled' implicitly has an 'any' type.
src/stores/room.ts(3,54): error TS2307: Cannot find module '@/types' or its corresponding type declarations.
2025-12-22 10:09:01 [ERROR] ❌ 脚本在第 194 行出错，退出码: 2
2025-12-22 10:09:01 [ERROR] ❌ 请查看日志文件: /var/log/p2p-chat-deploy.log
2025-12-22 10:09:01 [ERROR] ❌ 或运行: tail -100 /var/log/p2p-chat-deploy.log
root@vps-btar:/var/www/p2p-chat/p2p-chat/deploy# 
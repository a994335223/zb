root@vps-btar:/var/www/p2p-chat/p2p-chat/server# # 1. 查找占用 3001 端口的进程
lsof -i :3001

# 2. 杀掉该进程（假设 PID 是 xxxx）
kill -9 $(lsof -t -i :3001)

# 3. 重启 PM2
pm2 restart p2p-server

# 4. 查看日志确认正常
pm2 logs p2p-server --lines 10
COMMAND     PID USER   FD   TYPE DEVICE SIZE/OFF NODE NAME
node\x20/ 10009 root   20u  IPv4  50384      0t0  TCP *:3001 (LISTEN)
Use --update-env to update environment variables
[PM2] Applying action restartProcessId on app [p2p-server](ids: [ 1 ])
[PM2] [p2p-server](1) ✓
┌────┬───────────────┬─────────────┬─────────┬─────────┬──────────┬────────┬──────┬───────────┬──────────┬──────────┬──────────┬──────────┐
│ id │ name          │ namespace   │ version │ mode    │ pid      │ uptime │ ↺    │ status    │ cpu      │ mem      │ user     │ watching │
├────┼───────────────┼─────────────┼─────────┼─────────┼──────────┼────────┼──────┼───────────┼──────────┼──────────┼──────────┼──────────┤
│ 1  │ p2p-server    │ default     │ 1.0.0   │ fork    │ 10070    │ 0s     │ 17   │ online    │ 0%       │ 18.8mb   │ root     │ disabled │
└────┴───────────────┴─────────────┴─────────┴─────────┴──────────┴────────┴──────┴───────────┴──────────┴──────────┴──────────┴──────────┘
[TAILING] Tailing last 10 lines for [p2p-server] process (change the value with --lines option)
/root/.pm2/logs/p2p-server-error.log last 10 lines:
1|p2p-serv |     at Server.setupListenHandle [as _listen2] (node:net:1908:16)
1|p2p-serv |     at listenInCluster (node:net:1965:12)
1|p2p-serv |     at doListen (node:net:2139:7)
1|p2p-serv |     at processTicksAndRejections (node:internal/process/task_queues:83:21) {
1|p2p-serv |   code: 'EADDRINUSE',
1|p2p-serv |   errno: -98,
1|p2p-serv |   syscall: 'listen',
1|p2p-serv |   address: '0.0.0.0',
1|p2p-serv |   port: 3001
1|p2p-serv | }

/root/.pm2/logs/p2p-server-out.log last 10 lines:
1|p2p-serv | 
1|p2p-serv | 🚀 P2P Chat 信令服务器已启动！
1|p2p-serv | 
1|p2p-serv |    本地地址: http://localhost:3001
1|p2p-serv |    局域网地址: http://0.0.0.0:3001
1|p2p-serv |    健康检查: http://localhost:3001/health
1|p2p-serv |    
1|p2p-serv |    等待客户端连接...
1|p2p-serv |   

1|p2p-server  | 🚀 P2P Chat 信令服务器已启动！
1|p2p-server  |    本地地址: http://localhost:3001
1|p2p-server  |    局域网地址: http://0.0.0.0:3001
1|p2p-server  |    健康检查: http://localhost:3001/health
1|p2p-server  |    
1|p2p-server  |    等待客户端连接...
1|p2p-server  |   

root@vps-btar:/var/www/p2p-chat/p2p-chat/deploy# cd /var/www/p2p-chat && git pull && cd p2p-chat/client && npm run build
remote: Enumerating objects: 19, done.
remote: Counting objects: 100% (19/19), done.
remote: Compressing objects: 100% (5/5), done.
remote: Total 10 (delta 4), reused 10 (delta 4), pack-reused 0 (from 0)
Unpacking objects: 100% (10/10), 2.69 KiB | 551.00 KiB/s, done.
From https://github.com/a994335223/zb
   5a26891..eb568e8  main       -> origin/main
Updating 5a26891..eb568e8
Fast-forward
 log.md                               | 106 ++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++----------------
 p2p-chat/client/src/config/ice.ts    |   7 +++----
 p2p-chat/client/src/stores/socket.ts |  11 +++--------
 3 files changed, 96 insertions(+), 28 deletions(-)

> client@0.0.0 build
> vite build

vite v7.3.0 building client environment for production...
✓ 85 modules transformed.
dist/index.html                   0.45 kB │ gzip:  0.29 kB
dist/assets/index-BSF29abM.css   19.23 kB │ gzip:  3.74 kB
dist/assets/index-CGckrmzZ.js   176.40 kB │ gzip: 62.96 kB
✓ built in 4.79s
root@vps-btar:/var/www/p2p-chat/p2p-chat/client# 
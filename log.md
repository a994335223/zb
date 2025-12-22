root@vps-btar:/var/www/p2p-chat/p2p-chat/client# cd /var/www/p2p-chat && git pull && cd p2p-chat/client && npm run build
remote: Enumerating objects: 15, done.
remote: Counting objects: 100% (15/15), done.
remote: Compressing objects: 100% (4/4), done.
remote: Total 8 (delta 4), reused 8 (delta 4), pack-reused 0 (from 0)
Unpacking objects: 100% (8/8), 2.56 KiB | 655.00 KiB/s, done.
From https://github.com/a994335223/zb
   eb568e8..c1b9f27  main       -> origin/main
Updating eb568e8..c1b9f27
Fast-forward
 log.md                                       | 116 +++++++++++++++++++++++---------------------------------------------------------------------------------------------
 p2p-chat/client/src/composables/useWebRTC.ts | 140 ++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++------------------------------------------
 2 files changed, 121 insertions(+), 135 deletions(-)

> client@0.0.0 build
> vite build

vite v7.3.0 building client environment for production...
✓ 85 modules transformed.
dist/index.html                   0.45 kB │ gzip:  0.29 kB
dist/assets/index-BSF29abM.css   19.23 kB │ gzip:  3.74 kB
dist/assets/index-DeB9AA6b.js   177.23 kB │ gzip: 63.20 kB
✓ built in 4.67s
root@vps-btar:/var/www/p2p-chat/p2p-chat/client# 
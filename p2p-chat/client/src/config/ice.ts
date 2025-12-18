// ICE 服务器配置 - 开发/生产自动切换
const isDev = import.meta.env.DEV

export const iceConfig: RTCConfiguration = {
  iceServers: isDev 
    ? [
        // ========== 开发阶段：使用公共STUN（免费）==========
        { urls: 'stun:stun.voipbuster.com:3478' },
        { urls: 'stun:stun.ekiga.net:3478' },
        { urls: 'stun:stun.schlund.de:3478' },
        { urls: 'stun:stun.sipgate.net:10000' },
      ]
    : [
        // ========== 生产阶段：使用自建服务器 ==========
        { urls: import.meta.env.VITE_STUN_URL || 'stun:your-server.com:3478' },
        {
          urls: import.meta.env.VITE_TURN_URL || 'turn:your-server.com:3478',
          username: import.meta.env.VITE_TURN_USER || 'webrtc',
          credential: import.meta.env.VITE_TURN_PASS || 'password',
        },
      ]
}

// Socket 服务器地址 - 自动获取当前主机
const getSocketUrl = () => {
  // 如果有环境变量配置，优先使用
  if (import.meta.env.VITE_SOCKET_URL) {
    return import.meta.env.VITE_SOCKET_URL
  }
  // 否则使用当前访问的主机地址 + 后端端口
  const host = window.location.hostname
  return `http://${host}:3001`
}

export const SOCKET_URL = getSocketUrl()


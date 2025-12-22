// 用户信息
export interface UserInfo {
  id: string
  nickname: string
  avatar?: string
}

// 房间信息
export interface RoomInfo {
  id: string
  name: string
  userCount: number
}

// 聊天消息
export interface ChatMessage {
  id: string
  from: string
  nickname: string
  content: string
  timestamp: number
}

// WebRTC 连接统计信息
export interface WebRTCStats {
  // 连接类型: host=本地直连, srflx=STUN打洞, prflx=对等反射, relay=TURN中继
  connectionType: 'host' | 'srflx' | 'prflx' | 'relay' | 'unknown'
  // 本地候选类型
  localCandidateType: string
  // 远程候选类型
  remoteCandidateType: string
  // 接收比特率 (bps)
  inboundBitrate: number
  // 发送比特率 (bps)
  outboundBitrate: number
  // 丢包率 (0-100%)
  packetsLostPercent: number
  // 网络往返时间 (ms)
  roundTripTime: number
  // 抖动 (ms)
  jitter: number
  // 接收帧率
  framesPerSecond: number
  // 接收的帧数
  framesReceived: number
  // 丢弃的帧数
  framesDropped: number
}

// Peer 数据
export interface PeerData {
  peerId: string
  nickname: string
  stream: MediaStream | null
  isAudioEnabled: boolean
  isVideoEnabled: boolean
  // 🔑 新增：连接统计信息
  stats?: WebRTCStats
}

// 信令消息类型
export type SignalType = 'offer' | 'answer' | 'ice-candidate'

export interface SignalPayload {
  type: SignalType
  from: string
  to: string
  roomId: string
  payload: any
}

// DataChannel 消息类型
export interface DataChannelMessage {
  type: 'chat' | 'system'
  payload: ChatMessage | SystemMessage
}

// 系统消息（用于扩展）
export interface SystemMessage {
  action: string
  data?: any
}


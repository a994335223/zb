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

// Peer 数据
export interface PeerData {
  peerId: string
  nickname: string
  stream: MediaStream | null
  isAudioEnabled: boolean
  isVideoEnabled: boolean
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


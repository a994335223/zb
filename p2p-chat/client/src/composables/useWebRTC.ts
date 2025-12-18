import { ref, onUnmounted, watch, type Ref } from 'vue'
import { useSocketStore } from '@/stores/socket'
import { iceConfig } from '@/config/ice'
import type { PeerData } from '@/types'

export function useWebRTC(roomId: string, localStream: Ref<MediaStream | null>) {
  const socketStore = useSocketStore()
  const peers = ref<Map<string, PeerData>>(new Map())
  const peerConnections = new Map<string, RTCPeerConnection>()
  // 存储每个连接的 sender，用于后续更新轨道
  const trackSenders = new Map<string, Map<string, RTCRtpSender>>()

  // 创建 PeerConnection
  const createPeerConnection = (targetId: string, nickname = '用户'): RTCPeerConnection => {
    console.log(`🔗 Creating peer connection for: ${targetId}`)
    
    const pc = new RTCPeerConnection(iceConfig)
    peerConnections.set(targetId, pc)
    trackSenders.set(targetId, new Map())

    // 添加本地流
    if (localStream.value) {
      localStream.value.getTracks().forEach(track => {
        const sender = pc.addTrack(track, localStream.value!)
        trackSenders.get(targetId)?.set(track.kind, sender)
      })
    }

    // ICE 候选
    pc.onicecandidate = (event) => {
      if (event.candidate) {
        socketStore.socket?.emit('signal', {
          type: 'ice-candidate',
          to: targetId,
          roomId,
          payload: event.candidate,
        })
      }
    }

    // ICE 连接状态
    pc.oniceconnectionstatechange = () => {
      console.log(`🔌 ICE state (${targetId}):`, pc.iceConnectionState)
      if (pc.iceConnectionState === 'failed' || pc.iceConnectionState === 'disconnected') {
        removePeer(targetId)
      }
    }

    // 接收到远程流
    pc.ontrack = (event) => {
      console.log(`📺 Received track from: ${targetId}, kind: ${event.track.kind}`)
      const peerData = peers.value.get(targetId)
      if (peerData) {
        peerData.stream = event.streams[0]
        peers.value = new Map(peers.value)
      }
    }

    // 需要重新协商时（添加新轨道后会触发）
    pc.onnegotiationneeded = async () => {
      console.log(`🔄 Negotiation needed for: ${targetId}`)
      try {
        const offer = await pc.createOffer()
        await pc.setLocalDescription(offer)
        socketStore.socket?.emit('signal', {
          type: 'offer',
          to: targetId,
          roomId,
          payload: offer,
        })
      } catch (err) {
        console.error('❌ Renegotiation error:', err)
      }
    }

    // 添加到 peers Map
    const peerData: PeerData = {
      peerId: targetId,
      nickname,
      stream: null,
      isAudioEnabled: true,
      isVideoEnabled: true,
    }
    peers.value.set(targetId, peerData)
    peers.value = new Map(peers.value)

    return pc
  }

  // 更新所有 PeerConnection 的本地轨道
  const updateAllPeerTracks = async () => {
    if (!localStream.value) return
    
    console.log('🔄 Updating tracks for all peers...')
    
    for (const [peerId, pc] of peerConnections) {
      const senders = trackSenders.get(peerId) || new Map()
      
      for (const track of localStream.value.getTracks()) {
        const existingSender = senders.get(track.kind)
        
        if (existingSender) {
          // 替换现有轨道
          try {
            await existingSender.replaceTrack(track)
            console.log(`✅ Replaced ${track.kind} track for: ${peerId}`)
          } catch (err) {
            console.error(`❌ Replace track error:`, err)
          }
        } else {
          // 添加新轨道
          try {
            const sender = pc.addTrack(track, localStream.value!)
            senders.set(track.kind, sender)
            console.log(`✅ Added ${track.kind} track for: ${peerId}`)
          } catch (err) {
            console.error(`❌ Add track error:`, err)
          }
        }
      }
      
      trackSenders.set(peerId, senders)
    }
  }

  // 监听本地流变化，更新所有连接
  watch(localStream, (newStream, oldStream) => {
    if (newStream && newStream !== oldStream) {
      console.log('📹 Local stream changed, updating peers...')
      updateAllPeerTracks()
    }
  })

  // 发起呼叫 (创建 Offer)
  const createOffer = async (targetId: string, nickname = '用户') => {
    const pc = createPeerConnection(targetId, nickname)
    
    try {
      const offer = await pc.createOffer()
      await pc.setLocalDescription(offer)
      
      socketStore.socket?.emit('signal', {
        type: 'offer',
        to: targetId,
        roomId,
        payload: offer,
      })
      console.log(`📤 Offer sent to: ${targetId}`)
    } catch (err) {
      console.error('❌ Create offer error:', err)
    }
  }

  // 响应呼叫 (创建 Answer)
  const handleOffer = async (fromId: string, offer: RTCSessionDescriptionInit) => {
    let pc = peerConnections.get(fromId)
    if (!pc) {
      pc = createPeerConnection(fromId)
    }

    try {
      await pc.setRemoteDescription(new RTCSessionDescription(offer))
      const answer = await pc.createAnswer()
      await pc.setLocalDescription(answer)
      
      socketStore.socket?.emit('signal', {
        type: 'answer',
        to: fromId,
        roomId,
        payload: answer,
      })
      console.log(`📤 Answer sent to: ${fromId}`)
    } catch (err) {
      console.error('❌ Handle offer error:', err)
    }
  }

  // 处理 Answer
  const handleAnswer = async (fromId: string, answer: RTCSessionDescriptionInit) => {
    const pc = peerConnections.get(fromId)
    if (pc) {
      try {
        await pc.setRemoteDescription(new RTCSessionDescription(answer))
        console.log(`✅ Answer received from: ${fromId}`)
      } catch (err) {
        console.error('❌ Handle answer error:', err)
      }
    }
  }

  // 处理 ICE 候选
  const handleIceCandidate = async (fromId: string, candidate: RTCIceCandidateInit) => {
    const pc = peerConnections.get(fromId)
    if (pc) {
      try {
        await pc.addIceCandidate(new RTCIceCandidate(candidate))
      } catch (err) {
        console.error('❌ Add ICE candidate error:', err)
      }
    }
  }

  // 移除 Peer
  const removePeer = (peerId: string) => {
    const pc = peerConnections.get(peerId)
    if (pc) {
      pc.close()
      peerConnections.delete(peerId)
    }
    trackSenders.delete(peerId)
    peers.value.delete(peerId)
    peers.value = new Map(peers.value)
    console.log(`👋 Peer removed: ${peerId}`)
  }

  // 设置 Socket 监听器
  const setupSocketListeners = () => {
    const socket = socketStore.socket
    if (!socket) return

    // 新用户加入 -> 主动发起呼叫
    socket.on('user-joined', ({ userId, userInfo }) => {
      console.log('👤 User joined:', userId)
      createOffer(userId, userInfo?.nickname)
    })

    // 用户离开
    socket.on('user-left', ({ userId }) => {
      console.log('👤 User left:', userId)
      removePeer(userId)
    })

    // 收到信令
    socket.on('signal', ({ from, payload, type }) => {
      console.log(`📨 Signal from ${from}: ${type}`)
      
      switch (type) {
        case 'offer':
          handleOffer(from, payload)
          break
        case 'answer':
          handleAnswer(from, payload)
          break
        case 'ice-candidate':
          handleIceCandidate(from, payload)
          break
      }
    })

    // 获取房间现有用户 -> 主动发起呼叫给所有人
    socket.on('room-users', ({ users }) => {
      console.log('👥 Existing users:', users)
      users.forEach((userId: string) => {
        if (userId !== socket.id) {
          createOffer(userId)
        }
      })
    })

    // 媒体状态变更
    socket.on('user-media-state', ({ userId, isAudioEnabled, isVideoEnabled }) => {
      const peerData = peers.value.get(userId)
      if (peerData) {
        peerData.isAudioEnabled = isAudioEnabled
        peerData.isVideoEnabled = isVideoEnabled
        peers.value = new Map(peers.value)
      }
    })
  }

  // 清理 Socket 监听器
  const cleanupSocketListeners = () => {
    const socket = socketStore.socket
    if (!socket) return
    
    socket.off('user-joined')
    socket.off('user-left')
    socket.off('signal')
    socket.off('room-users')
    socket.off('user-media-state')
  }

  // 监听 socket 连接状态
  watch(() => socketStore.isConnected, (connected) => {
    if (connected) {
      setupSocketListeners()
    }
  }, { immediate: true })

  // 组件卸载时清理
  onUnmounted(() => {
    cleanupSocketListeners()
    peerConnections.forEach((pc) => pc.close())
    peerConnections.clear()
    trackSenders.clear()
    peers.value.clear()
  })

  return {
    peers,
    removePeer,
    updateAllPeerTracks, // 导出供外部调用
  }
}

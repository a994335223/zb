import { ref, onUnmounted, watch, type Ref } from 'vue'
import { useSocketStore } from '@/stores/socket'
import { iceConfig } from '@/config/ice'
import type { PeerData, WebRTCStats, ChatMessage, DataChannelMessage } from '@/types'

// 🔑 根据分辨率计算合理的最大码率（单位：bps）
// 4K 60fps: 100-200 Mbps
// 1080p 60fps: 20-50 Mbps
// 720p 30fps: 5-10 Mbps
function calculateMaxBitrate(width: number, height: number, fps: number): number {
  const pixels = width * height
  
  // 4K (>= 3840x2160 = 8.3M pixels)
  if (pixels >= 8000000) {
    return fps >= 50 ? 200_000_000 : 100_000_000 // 200 or 100 Mbps
  }
  // 1440p (>= 2560x1440 = 3.7M pixels)
  if (pixels >= 3500000) {
    return fps >= 50 ? 80_000_000 : 50_000_000 // 80 or 50 Mbps
  }
  // 1080p (>= 1920x1080 = 2M pixels)
  if (pixels >= 2000000) {
    return fps >= 50 ? 50_000_000 : 25_000_000 // 50 or 25 Mbps
  }
  // 720p (>= 1280x720 = 0.9M pixels)
  if (pixels >= 900000) {
    return fps >= 50 ? 20_000_000 : 10_000_000 // 20 or 10 Mbps
  }
  // 其他
  return 8_000_000 // 8 Mbps
}

export function useWebRTC(roomId: string, localStream: Ref<MediaStream | null>) {
  const socketStore = useSocketStore()
  const peers = ref<Map<string, PeerData>>(new Map())
  const peerConnections = new Map<string, RTCPeerConnection>()
  const trackSenders = new Map<string, Map<string, RTCRtpSender>>()
  const isOfferer = new Map<string, boolean>()
  const isNegotiating = new Map<string, boolean>()
  
  // 🔑 DataChannel - P2P 消息传输
  const dataChannels = new Map<string, RTCDataChannel>()
  const onMessageCallbacks = ref<((msg: ChatMessage) => void)[]>([])
  
  // 🔑 是否保持分辨率不降级（默认开启 - 适合高画质需求）
  const maintainResolution = ref<boolean>(true)
  
  // 📊 统计信息相关
  const lastStatsData = new Map<string, { 
    timestamp: number
    bytesReceived: number
    bytesSent: number
    packetsReceived: number
    packetsLost: number
  }>()
  let statsInterval: number | null = null

  // 获取单个 Peer 的统计信息
  const getStatsForPeer = async (peerId: string): Promise<WebRTCStats | null> => {
    const pc = peerConnections.get(peerId)
    if (!pc) return null

    try {
      const stats = await pc.getStats()
      const result: WebRTCStats = {
        connectionType: 'unknown',
        localCandidateType: '',
        remoteCandidateType: '',
        inboundBitrate: 0,
        outboundBitrate: 0,
        packetsLostPercent: 0,
        roundTripTime: 0,
        jitter: 0,
        framesPerSecond: 0,
        framesReceived: 0,
        framesDropped: 0,
      }

      let currentBytesReceived = 0
      let currentBytesSent = 0
      let currentPacketsReceived = 0
      let currentPacketsLost = 0
      let activeCandidatePairId = ''

      stats.forEach((report) => {
        // 获取活跃的候选对
        if (report.type === 'transport') {
          activeCandidatePairId = report.selectedCandidatePairId || ''
        }

        // 候选对信息 - 获取连接类型和 RTT
        if (report.type === 'candidate-pair' && report.state === 'succeeded') {
          result.roundTripTime = Math.round((report.currentRoundTripTime || 0) * 1000)
          
          // 获取本地和远程候选信息
          const localCandidateId = report.localCandidateId
          const remoteCandidateId = report.remoteCandidateId
          
          stats.forEach((candidateReport) => {
            if (candidateReport.id === localCandidateId && candidateReport.type === 'local-candidate') {
              result.localCandidateType = candidateReport.candidateType || ''
              // 连接类型取决于本地候选类型
              result.connectionType = candidateReport.candidateType as any || 'unknown'
            }
            if (candidateReport.id === remoteCandidateId && candidateReport.type === 'remote-candidate') {
              result.remoteCandidateType = candidateReport.candidateType || ''
            }
          })
        }

        // 入站 RTP（接收）
        if (report.type === 'inbound-rtp' && report.kind === 'video') {
          currentBytesReceived = report.bytesReceived || 0
          currentPacketsReceived = report.packetsReceived || 0
          currentPacketsLost = report.packetsLost || 0
          result.jitter = Math.round((report.jitter || 0) * 1000)
          result.framesPerSecond = report.framesPerSecond || 0
          result.framesReceived = report.framesReceived || 0
          result.framesDropped = report.framesDropped || 0
        }

        // 出站 RTP（发送）
        if (report.type === 'outbound-rtp' && report.kind === 'video') {
          currentBytesSent = report.bytesSent || 0
        }
      })

      // 计算比特率（需要与上次数据对比）
      const lastData = lastStatsData.get(peerId)
      const now = Date.now()
      
      if (lastData) {
        const timeDiff = (now - lastData.timestamp) / 1000 // 秒
        if (timeDiff > 0) {
          result.inboundBitrate = Math.round(((currentBytesReceived - lastData.bytesReceived) * 8) / timeDiff)
          result.outboundBitrate = Math.round(((currentBytesSent - lastData.bytesSent) * 8) / timeDiff)
          
          // 计算丢包率
          const totalPackets = currentPacketsReceived - lastData.packetsReceived
          const lostPackets = currentPacketsLost - lastData.packetsLost
          if (totalPackets > 0) {
            result.packetsLostPercent = Math.round((lostPackets / (totalPackets + lostPackets)) * 100 * 10) / 10
          }
        }
      }

      // 保存当前数据
      lastStatsData.set(peerId, {
        timestamp: now,
        bytesReceived: currentBytesReceived,
        bytesSent: currentBytesSent,
        packetsReceived: currentPacketsReceived,
        packetsLost: currentPacketsLost,
      })

      return result
    } catch (err) {
      console.error('❌ Get stats error:', err)
      return null
    }
  }

  // 更新所有 Peer 的统计信息
  const updateAllPeerStats = async (): Promise<void> => {
    for (const [peerId, peerData] of peers.value) {
      const stats = await getStatsForPeer(peerId)
      if (stats) {
        peerData.stats = stats
      }
    }
    // 触发响应式更新
    peers.value = new Map(peers.value)
  }

  // 启动统计信息定时更新
  const startStatsCollection = (): void => {
    if (statsInterval) return
    statsInterval = window.setInterval(updateAllPeerStats, 1000) // 每秒更新
    console.log('📊 Stats collection started')
  }

  // 停止统计信息收集
  const stopStatsCollection = (): void => {
    if (statsInterval) {
      clearInterval(statsInterval)
      statsInterval = null
      console.log('📊 Stats collection stopped')
    }
  }

  // ========== 📨 DataChannel P2P 消息功能 ==========
  
  // 处理收到的 DataChannel 消息
  const handleDataChannelMessage = (peerId: string, event: MessageEvent): void => {
    try {
      const data: DataChannelMessage = JSON.parse(event.data)
      
      if (data.type === 'chat') {
        const chatMsg = data.payload as ChatMessage
        console.log(`📨 [P2P] Received chat from ${peerId}:`, chatMsg.content)
        
        // 触发所有注册的回调
        onMessageCallbacks.value.forEach(cb => cb(chatMsg))
      }
    } catch (err) {
      console.error('❌ Failed to parse DataChannel message:', err)
    }
  }

  // 设置 DataChannel 事件监听
  const setupDataChannel = (channel: RTCDataChannel, peerId: string): void => {
    channel.onopen = () => {
      console.log(`📡 [P2P] DataChannel opened with: ${peerId}`)
      dataChannels.set(peerId, channel)
    }
    
    channel.onclose = () => {
      console.log(`📡 [P2P] DataChannel closed with: ${peerId}`)
      dataChannels.delete(peerId)
    }
    
    channel.onerror = (err) => {
      console.error(`❌ [P2P] DataChannel error with ${peerId}:`, err)
    }
    
    channel.onmessage = (event) => handleDataChannelMessage(peerId, event)
  }

  // 注册消息回调
  const onMessage = (callback: (msg: ChatMessage) => void): void => {
    onMessageCallbacks.value.push(callback)
  }

  // 移除消息回调
  const offMessage = (callback: (msg: ChatMessage) => void): void => {
    const index = onMessageCallbacks.value.indexOf(callback)
    if (index > -1) {
      onMessageCallbacks.value.splice(index, 1)
    }
  }

  // 🔑 广播消息到所有已连接的 Peer（P2P 方式）
  const broadcastMessage = (message: ChatMessage): void => {
    const dataMsg: DataChannelMessage = {
      type: 'chat',
      payload: message
    }
    const msgStr = JSON.stringify(dataMsg)
    
    let sentCount = 0
    dataChannels.forEach((channel, peerId) => {
      if (channel.readyState === 'open') {
        channel.send(msgStr)
        sentCount++
        console.log(`📤 [P2P] Sent to ${peerId}`)
      } else {
        console.warn(`⚠️ [P2P] Channel not ready for ${peerId}, state: ${channel.readyState}`)
      }
    })
    
    console.log(`📤 [P2P] Broadcast message to ${sentCount}/${dataChannels.size} peers`)
  }

  // 获取已连接的 DataChannel 数量
  const getConnectedChannelsCount = (): number => {
    let count = 0
    dataChannels.forEach(channel => {
      if (channel.readyState === 'open') count++
    })
    return count
  }

  // ========== 📨 DataChannel 功能结束 ==========

  // 🔑 设置编解码器优先级：AV1 > H.265/HEVC > VP9 > VP8
  const setCodecPreferences = (pc: RTCPeerConnection): void => {
    try {
      const transceivers = pc.getTransceivers()
      
      for (const transceiver of transceivers) {
        if (transceiver.receiver.track?.kind === 'video') {
          // 获取支持的编解码器
          const codecs = RTCRtpReceiver.getCapabilities('video')?.codecs || []
          
          // 定义优先级顺序
          const codecPriority = [
            'AV1',      // 最高优先级
            'H265',     // H.265/HEVC
            'HEVC',     // HEVC 的另一种表示
            'VP9',      // VP9
            'VP8',      // VP8（最低优先级）
          ]
          
          // 按优先级排序编解码器
          const sortedCodecs = codecs.sort((a, b) => {
            const aPriority = codecPriority.findIndex(priority => 
              a.mimeType.toUpperCase().includes(priority)
            )
            const bPriority = codecPriority.findIndex(priority => 
              b.mimeType.toUpperCase().includes(priority)
            )
            
            // 如果都找不到，保持原顺序
            if (aPriority === -1 && bPriority === -1) return 0
            if (aPriority === -1) return 1
            if (bPriority === -1) return -1
            
            return aPriority - bPriority
          })
          
          // 设置编解码器偏好
          if ('setCodecPreferences' in transceiver && sortedCodecs.length > 0) {
            transceiver.setCodecPreferences(sortedCodecs)
            console.log('🎬 Codec preferences set:', sortedCodecs.map(c => c.mimeType).join(', '))
          }
        }
      }
    } catch (err) {
      console.warn('⚠️ Failed to set codec preferences:', err)
    }
  }

  // 🔑 修改 SDP 以设置编解码器优先级（备用方案）
  const modifySdpForCodecPriority = (sdp: string): string => {
    try {
      // 定义编解码器优先级（按 MIME type）
      const codecPriority = [
        { pattern: /AV1/i, priority: 1 },
        { pattern: /H265|HEVC/i, priority: 2 },
        { pattern: /VP9/i, priority: 3 },
        { pattern: /VP8/i, priority: 4 },
        { pattern: /H264/i, priority: 5 }, // H.264 作为备选
      ]
      
      // 查找 m=video 行
      const lines = sdp.split('\r\n')
      let inVideoSection = false
      let videoPayloadTypes: Array<{ line: string; priority: number; payloadType: string }> = []
      
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i]
        
        if (line.startsWith('m=video')) {
          inVideoSection = true
          continue
        }
        
        if (inVideoSection && line.startsWith('m=')) {
          // 进入下一个媒体部分，停止处理
          break
        }
        
        if (inVideoSection && line.startsWith('a=rtpmap:')) {
          // 解析 rtpmap 行：a=rtpmap:96 VP9/90000
          const match = line.match(/a=rtpmap:(\d+)\s+([^\s\/]+)/)
          if (match) {
            const payloadType = match[1]
            const codecName = match[2]
            
            // 查找优先级
            const priorityInfo = codecPriority.find(p => p.pattern.test(codecName))
            const priority = priorityInfo ? priorityInfo.priority : 999
            
            videoPayloadTypes.push({ line, priority, payloadType })
          }
        }
      }
      
      // 如果找到了编解码器，按优先级排序
      if (videoPayloadTypes.length > 0) {
        videoPayloadTypes.sort((a, b) => a.priority - b.priority)
        
        // 重新构建 SDP，将高优先级的编解码器放在前面
        // 这需要在 m=video 行中重新排序 payload types
        const videoLineIndex = lines.findIndex(l => l.startsWith('m=video'))
        if (videoLineIndex !== -1) {
          const videoLine = lines[videoLineIndex]
          // m=video 9 UDP/TLS/RTP/SAVPF 96 97 98
          const match = videoLine.match(/m=video\s+(\d+)\s+([^\s]+)\s+(.+)/)
          if (match) {
            const payloadTypes = videoPayloadTypes.map(v => v.payloadType).join(' ')
            lines[videoLineIndex] = `m=video ${match[1]} ${match[2]} ${payloadTypes}`
            console.log('🎬 SDP modified for codec priority:', payloadTypes)
          }
        }
      }
      
      return lines.join('\r\n')
    } catch (err) {
      console.warn('⚠️ Failed to modify SDP for codec priority:', err)
      return sdp
    }
  }

  // 🔑 核心：设置 sender 的编码参数，强制保持分辨率
  const applySenderDegradationPreference = async (sender: RTCRtpSender): Promise<void> => {
    if (!sender.track || sender.track.kind !== 'video') return
    
    try {
      // 1. 设置视频轨道的 contentHint（告诉编码器优先级）
      // 'detail' = 优先清晰度（降帧率不降分辨率）
      // 'motion' = 优先流畅（降分辨率不降帧率）
      if ('contentHint' in sender.track) {
        (sender.track as any).contentHint = maintainResolution.value ? 'detail' : 'motion'
        console.log(`🎯 contentHint set to: ${(sender.track as any).contentHint}`)
      }
      
      // 2. 获取编码参数
      const params = sender.getParameters()
      if (!params.encodings || params.encodings.length === 0) {
        params.encodings = [{}]
      }
      
      // 3. 获取当前视频轨道的实际设置
      const settings = sender.track.getSettings()
      const width = settings.width || 1920
      const height = settings.height || 1080
      const fps = settings.frameRate || 30
      
      // 4. 计算合适的码率
      const maxBitrate = calculateMaxBitrate(width, height, fps)
      
      // 5. 设置编码参数
      for (const encoding of params.encodings) {
        if (maintainResolution.value) {
          // 🔒 强制保持分辨率模式
          (encoding as any).degradationPreference = 'maintain-resolution'
          encoding.scaleResolutionDownBy = 1 // 绝对不缩放
          encoding.maxBitrate = maxBitrate
          (encoding as any).priority = 'high'
          (encoding as any).networkPriority = 'high'
        } else {
          // 允许自动调整
          (encoding as any).degradationPreference = 'balanced'
          encoding.scaleResolutionDownBy = 1
          encoding.maxBitrate = 8_000_000 // 8 Mbps
        }
      }
      
      await sender.setParameters(params)
      
      console.log(`🔒 Video sender configured:`, {
        resolution: `${width}×${height}@${fps}fps`,
        maxBitrate: `${(maxBitrate / 1_000_000).toFixed(0)} Mbps`,
        maintainResolution: maintainResolution.value,
        degradationPreference: (params.encodings[0] as any).degradationPreference,
        scaleResolutionDownBy: params.encodings[0].scaleResolutionDownBy,
      })
    } catch (err) {
      console.error('❌ Failed to set sender parameters:', err)
    }
  }

  // 更新所有 video sender 的参数
  const updateAllSendersDegradation = async (): Promise<void> => {
    const promises: Promise<void>[] = []
    for (const [, senders] of trackSenders) {
      const videoSender = senders.get('video')
      if (videoSender) {
        promises.push(applySenderDegradationPreference(videoSender))
      }
    }
    await Promise.all(promises)
  }

  // 切换分辨率保持模式
  const setMaintainResolution = async (value: boolean): Promise<void> => {
    maintainResolution.value = value
    console.log('🔒 Maintain resolution:', value ? '开启（强制保持分辨率）' : '关闭（允许自动调整）')
    await updateAllSendersDegradation()
  }

  // 添加本地轨道到 PeerConnection（同步添加，之后设置参数）
  const addLocalTracksToPC = async (pc: RTCPeerConnection, targetId: string): Promise<void> => {
    if (!localStream.value) return
    
    const senders = trackSenders.get(targetId) || new Map<string, RTCRtpSender>()
    
    for (const track of localStream.value.getTracks()) {
      if (!senders.has(track.kind)) {
        const sender = pc.addTrack(track, localStream.value)
        senders.set(track.kind, sender)
        console.log(`✅ Added ${track.kind} track to PC for: ${targetId}`)
      }
    }
    
    trackSenders.set(targetId, senders)
  }

  // 在 SDP 协商完成后设置视频参数（关键时机！）
  const applyVideoParamsAfterNegotiation = async (targetId: string): Promise<void> => {
    const senders = trackSenders.get(targetId)
    if (!senders) return
    
    const videoSender = senders.get('video')
    if (videoSender) {
      // 稍微延迟，确保协商完全完成
      await new Promise(resolve => setTimeout(resolve, 100))
      await applySenderDegradationPreference(videoSender)
    }
  }

  // 创建 PeerConnection
  const createPeerConnection = (targetId: string, nickname = '用户', asOfferer = false): RTCPeerConnection => {
    console.log(`🔗 Creating peer connection for: ${targetId}, asOfferer: ${asOfferer}`)
    
    const pc = new RTCPeerConnection(iceConfig)
    peerConnections.set(targetId, pc)
    trackSenders.set(targetId, new Map())
    isNegotiating.set(targetId, false)

    // 🔑 如果是发起方，创建 DataChannel
    if (asOfferer) {
      const channel = pc.createDataChannel('chat', {
        ordered: true, // 保证消息顺序
      })
      setupDataChannel(channel, targetId)
      console.log(`📡 [P2P] DataChannel created for: ${targetId}`)
    }

    // 🔑 接收对方创建的 DataChannel
    pc.ondatachannel = (event) => {
      console.log(`📡 [P2P] DataChannel received from: ${targetId}`)
      setupDataChannel(event.channel, targetId)
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
      
      // ICE 连接成功后，重新应用视频参数（确保生效）
      if (pc.iceConnectionState === 'connected') {
        applyVideoParamsAfterNegotiation(targetId)
      }
      
      if (pc.iceConnectionState === 'failed' || pc.iceConnectionState === 'disconnected') {
        removePeer(targetId)
      }
    }

    // 接收到远程流
    pc.ontrack = (event) => {
      console.log(`📺 Received track from: ${targetId}, kind: ${event.track.kind}`)
      const peerData = peers.value.get(targetId)
      if (peerData) {
        if (event.streams && event.streams[0]) {
          peerData.stream = event.streams[0]
          console.log(`✅ Remote stream tracks: ${event.streams[0].getTracks().map(t => t.kind).join(', ')}`)
        } else {
          if (!peerData.stream) {
            peerData.stream = new MediaStream()
          }
          peerData.stream.addTrack(event.track)
          console.log(`✅ Added remote ${event.track.kind} track to stream`)
        }
        
        // 监听轨道状态
        event.track.onended = () => console.log(`⚠️ Remote track ended: ${event.track.kind}`)
        event.track.onmute = () => console.log(`🔇 Remote track muted: ${event.track.kind}`)
        event.track.onunmute = () => console.log(`🔊 Remote track unmuted: ${event.track.kind}`)
        
        peers.value = new Map(peers.value)
      }
    }

    // 信令状态
    pc.onsignalingstatechange = () => {
      console.log(`📡 Signaling state (${targetId}):`, pc.signalingState)
      if (pc.signalingState === 'stable') {
        isNegotiating.set(targetId, false)
      }
    }

    // 需要重新协商 - 使用防抖避免频繁触发
    let negotiationTimeout: number | null = null
    pc.onnegotiationneeded = async () => {
      // 只有 offerer 才主动发起协商
      if (!isOfferer.get(targetId)) {
        console.log(`⏭️ Skipping negotiation (not offerer) for: ${targetId}`)
        return
      }
      
      // 如果正在协商中，跳过
      if (isNegotiating.get(targetId)) {
        console.log(`⏭️ Skipping negotiation (already negotiating) for: ${targetId}`)
        return
      }
      
      // 防抖：等待 100ms 再执行，避免频繁触发
      if (negotiationTimeout) {
        clearTimeout(negotiationTimeout)
      }
      
      negotiationTimeout = window.setTimeout(async () => {
        if (pc.signalingState !== 'stable') {
          console.log(`⏭️ Skipping negotiation (state: ${pc.signalingState}) for: ${targetId}`)
          return
        }
        
        console.log(`🔄 Renegotiation needed for: ${targetId}`)
        isNegotiating.set(targetId, true)

        try {
          // 🔑 设置编解码器优先级
          setCodecPreferences(pc)
          
          const offer = await pc.createOffer()
          
          // 🔑 如果 setCodecPreferences 不可用，修改 SDP 作为备用方案
          if (offer.sdp) {
            offer.sdp = modifySdpForCodecPriority(offer.sdp)
          }
          
          await pc.setLocalDescription(offer)
          socketStore.socket?.emit('signal', {
            type: 'offer',
            to: targetId,
            roomId,
            payload: offer,
          })
        } catch (err) {
          console.error('❌ Renegotiation error:', err)
          isNegotiating.set(targetId, false)
        }
      }, 100)
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
  const updateAllPeerTracks = async (): Promise<void> => {
    if (!localStream.value) return
    
    console.log('🔄 Updating tracks for all peers...')
    console.log('📹 Current local tracks:', localStream.value.getTracks().map(t => `${t.kind}:${t.id.slice(0,8)}`))
    
    for (const [peerId, pc] of peerConnections) {
      if (pc.connectionState === 'closed') {
        console.log(`⚠️ PC for ${peerId} is closed, skipping`)
        continue
      }
      
      const senders = trackSenders.get(peerId) || new Map()
      let needsRenegotiation = false
      
      for (const track of localStream.value.getTracks()) {
        const existingSender = senders.get(track.kind)
        
        if (existingSender) {
          // 检查 sender 是否还有效
          const currentTrack = existingSender.track
          console.log(`🔄 Sender ${track.kind} current track: ${currentTrack?.id?.slice(0,8) || 'none'}, new track: ${track.id.slice(0,8)}`)
          
          try {
            await existingSender.replaceTrack(track)
            console.log(`✅ Replaced ${track.kind} track for: ${peerId}`)
            
            if (track.kind === 'video') {
              // 延迟设置参数，确保 track 已经生效
              setTimeout(async () => {
                await applySenderDegradationPreference(existingSender)
              }, 200)
            }
          } catch (err) {
            console.error(`❌ Replace track error for ${peerId}:`, err)
            // replaceTrack 失败，尝试重新添加
            try {
              pc.getSenders().forEach(s => {
                if (s.track?.kind === track.kind) {
                  pc.removeTrack(s)
                }
              })
              const newSender = pc.addTrack(track, localStream.value!)
              senders.set(track.kind, newSender)
              needsRenegotiation = true
              console.log(`✅ Re-added ${track.kind} track for: ${peerId}`)
            } catch (addErr) {
              console.error(`❌ Re-add track error:`, addErr)
            }
          }
        } else {
          try {
            const sender = pc.addTrack(track, localStream.value!)
            senders.set(track.kind, sender)
            needsRenegotiation = true
            console.log(`✅ Added ${track.kind} track for: ${peerId}`)
          } catch (err) {
            console.error(`❌ Add track error:`, err)
          }
        }
      }
      
      trackSenders.set(peerId, senders)
      
      // 需要重新协商（添加新 track 或 replaceTrack 失败后）
      if (needsRenegotiation && pc.signalingState === 'stable') {
        console.log(`🔄 Triggering renegotiation for: ${peerId}`)
        isOfferer.set(peerId, true)
        isNegotiating.set(peerId, true)
        try {
          // 🔑 设置编解码器优先级
          setCodecPreferences(pc)
          
          const offer = await pc.createOffer()
          
          // 🔑 如果 setCodecPreferences 不可用，修改 SDP 作为备用方案
          if (offer.sdp) {
            offer.sdp = modifySdpForCodecPriority(offer.sdp)
          }
          
          await pc.setLocalDescription(offer)
          socketStore.socket?.emit('signal', {
            type: 'offer',
            to: peerId,
            roomId,
            payload: offer,
          })
        } catch (err) {
          console.error('❌ Renegotiation error:', err)
          isNegotiating.set(peerId, false)
        }
      }
    }
  }

  // 监听本地流变化
  watch(localStream, (newStream, oldStream) => {
    if (newStream && newStream !== oldStream) {
      console.log('📹 Local stream changed, updating peers...')
      updateAllPeerTracks()
    }
  })

  // 发起呼叫 (创建 Offer)
  const createOffer = async (targetId: string, nickname = '用户'): Promise<void> => {
    // 检查是否已有连接
    if (peerConnections.has(targetId)) {
      console.log(`⚠️ PC already exists for: ${targetId}, skipping createOffer`)
      return
    }
    
    isOfferer.set(targetId, true)
    isNegotiating.set(targetId, true)
    
    const pc = createPeerConnection(targetId, nickname, true) // 🔑 asOfferer = true
    
    // 🔑 先添加 transceivers（保证 m-line 顺序一致）
    // 无论是否有本地流，都添加 audio 和 video transceiver
    if (localStream.value) {
      // 有本地流，添加轨道
      await addLocalTracksToPC(pc, targetId)
    } else {
      // 没有本地流，添加 recvonly transceiver（顺序：audio, video）
      console.log('📡 No local stream, adding recvonly transceivers')
      pc.addTransceiver('audio', { direction: 'recvonly' })
      pc.addTransceiver('video', { direction: 'recvonly' })
    }
    
    // 🔑 设置编解码器优先级：AV1 > H.265/HEVC > VP9 > VP8
    setCodecPreferences(pc)
    
    // 稍微延迟，确保 transceiver 设置完成
    await new Promise(resolve => setTimeout(resolve, 50))
    
    try {
      const offer = await pc.createOffer()
      
      // 🔑 如果 setCodecPreferences 不可用，修改 SDP 作为备用方案
      if (offer.sdp) {
        offer.sdp = modifySdpForCodecPriority(offer.sdp)
      }
      
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
      isNegotiating.set(targetId, false)
    }
  }

  // 响应呼叫 (创建 Answer) - Perfect Negotiation 模式
  const handleOffer = async (fromId: string, offer: RTCSessionDescriptionInit): Promise<void> => {
    let pc = peerConnections.get(fromId)
    const myId = socketStore.socket?.id || ''
    
    // 🔑 Perfect Negotiation: 决定谁是 "polite peer"
    // ID 较小的是 polite peer，会让步
    const imPolite = myId < fromId
    
    // 处理 glare（双方同时发 offer）
    if (pc && pc.signalingState !== 'stable') {
      if (!imPolite) {
        // 我是 impolite peer，忽略对方的 offer
        console.log(`⏭️ Ignoring offer from ${fromId} (I'm impolite, my offer takes priority)`)
        return
      }
      
      // 我是 polite peer，回滚我的 offer，接受对方的
      console.log(`🔄 Rolling back my offer, accepting offer from ${fromId} (I'm polite)`)
      try {
        await pc.setLocalDescription({ type: 'rollback' })
      } catch (e) {
        // rollback 可能失败，继续处理
        console.warn('⚠️ Rollback failed, trying to continue')
      }
      isOfferer.set(fromId, false)
      isNegotiating.set(fromId, false)
    }
    
    if (!pc) {
      isOfferer.set(fromId, false)
      pc = createPeerConnection(fromId, '用户', false) // 不是 offerer
    }

    try {
      await pc.setRemoteDescription(new RTCSessionDescription(offer))
      
      // 添加本地轨道（如果有）
      await addLocalTracksToPC(pc, fromId)
      
      // 🔑 设置编解码器优先级：AV1 > H.265/HEVC > VP9 > VP8
      setCodecPreferences(pc)
      
      // 创建 answer
      const answer = await pc.createAnswer()
      
      // 🔑 如果 setCodecPreferences 不可用，修改 SDP 作为备用方案
      if (answer.sdp) {
        answer.sdp = modifySdpForCodecPriority(answer.sdp)
      }
      
      await pc.setLocalDescription(answer)
      
      socketStore.socket?.emit('signal', {
        type: 'answer',
        to: fromId,
        roomId,
        payload: answer,
      })
      console.log(`📤 Answer sent to: ${fromId}`)
      
      // 🔑 关键：在 answer 发送后设置视频参数
      await applyVideoParamsAfterNegotiation(fromId)
    } catch (err) {
      console.error('❌ Handle offer error:', err)
    }
  }

  // 处理 Answer
  const handleAnswer = async (fromId: string, answer: RTCSessionDescriptionInit): Promise<void> => {
    const pc = peerConnections.get(fromId)
    if (!pc) {
      console.warn(`⚠️ No PC found for answer from: ${fromId}`)
      return
    }
    
    // 只有在 have-local-offer 状态下才能接收 answer
    if (pc.signalingState !== 'have-local-offer') {
      console.warn(`⚠️ Ignoring answer (state: ${pc.signalingState}) from: ${fromId}`)
      return
    }
    
    try {
      await pc.setRemoteDescription(new RTCSessionDescription(answer))
      console.log(`✅ Answer received from: ${fromId}`)
      isNegotiating.set(fromId, false)
      
      // 🔑 关键：在收到 answer 后设置视频参数（SDP 协商完成）
      await applyVideoParamsAfterNegotiation(fromId)
    } catch (err) {
      console.error('❌ Handle answer error:', err)
      isNegotiating.set(fromId, false)
    }
  }

  // 处理 ICE 候选
  const handleIceCandidate = async (fromId: string, candidate: RTCIceCandidateInit): Promise<void> => {
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
  const removePeer = (peerId: string): void => {
    // 关闭 DataChannel
    const channel = dataChannels.get(peerId)
    if (channel) {
      channel.close()
      dataChannels.delete(peerId)
    }
    
    const pc = peerConnections.get(peerId)
    if (pc) {
      pc.close()
      peerConnections.delete(peerId)
    }
    trackSenders.delete(peerId)
    isOfferer.delete(peerId)
    isNegotiating.delete(peerId)
    lastStatsData.delete(peerId)
    peers.value.delete(peerId)
    peers.value = new Map(peers.value)
    console.log(`👋 Peer removed: ${peerId}`)
  }

  // Socket 监听器
  const setupSocketListeners = (): void => {
    const socket = socketStore.socket
    if (!socket) return

    socket.on('user-joined', ({ userId, userInfo }) => {
      console.log('👤 User joined:', userId)
      createOffer(userId, userInfo?.nickname)
    })

    socket.on('user-left', ({ userId }) => {
      console.log('👤 User left:', userId)
      removePeer(userId)
    })

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

    socket.on('room-users', ({ users }) => {
      console.log('👥 Existing users:', users)
      users.forEach((userId: string) => {
        if (userId !== socket.id) {
          createOffer(userId)
        }
      })
    })

    socket.on('user-media-state', ({ userId, isAudioEnabled, isVideoEnabled }) => {
      const peerData = peers.value.get(userId)
      if (peerData) {
        peerData.isAudioEnabled = isAudioEnabled
        peerData.isVideoEnabled = isVideoEnabled
        peers.value = new Map(peers.value)
      }
    })
  }

  const cleanupSocketListeners = (): void => {
    const socket = socketStore.socket
    if (!socket) return
    
    socket.off('user-joined')
    socket.off('user-left')
    socket.off('signal')
    socket.off('room-users')
    socket.off('user-media-state')
  }

  watch(() => socketStore.isConnected, (connected) => {
    if (connected) {
      setupSocketListeners()
      startStatsCollection() // 🔑 启动统计信息收集
    }
  }, { immediate: true })

  onUnmounted(() => {
    stopStatsCollection() // 🔑 停止统计收集
    cleanupSocketListeners()
    
    // 关闭所有 DataChannel
    dataChannels.forEach(channel => channel.close())
    dataChannels.clear()
    onMessageCallbacks.value = []
    
    peerConnections.forEach((pc) => pc.close())
    peerConnections.clear()
    trackSenders.clear()
    isOfferer.clear()
    isNegotiating.clear()
    lastStatsData.clear()
    peers.value.clear()
  })

  return {
    peers,
    removePeer,
    updateAllPeerTracks,
    maintainResolution,
    setMaintainResolution,
    // 🔑 DataChannel P2P 消息
    broadcastMessage,
    onMessage,
    offMessage,
    getConnectedChannelsCount,
  }
}

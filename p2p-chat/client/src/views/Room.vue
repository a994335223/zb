<script setup lang="ts">
import { ref, onMounted, onUnmounted, computed, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useSocketStore } from '@/stores/socket'
import { useRoomStore } from '@/stores/room'
import { useMediaStream } from '@/composables/useMediaStream'
import { useWebRTC } from '@/composables/useWebRTC'
import VideoGrid from '@/components/video/VideoGrid.vue'
import Controls from '@/components/video/Controls.vue'
import ChatPanel from '@/components/chat/ChatPanel.vue'
import CameraSettings from '@/components/video/CameraSettings.vue'
import type { ChatMessage } from '@/types'

const route = useRoute()
const router = useRouter()
const socketStore = useSocketStore()
const roomStore = useRoomStore()

const roomId = route.params.roomId as string
const isJoined = ref(false)
const showChat = ref(false)
const showCameraSettings = ref(false)
const errorMsg = ref('')
const unreadCount = ref(0) // 未读消息数

// 是否为移动设备
const isMobile = computed(() => /Android|iPhone|iPad|iPod/i.test(navigator.userAgent))

// 媒体流
const { 
  stream: localStream, 
  isAudioEnabled, 
  isVideoEnabled,
  currentFacingMode, // 🔑 获取当前摄像头朝向
  videoMode,         // 🎬 视频模式
  startMedia, 
  stopMedia, 
  toggleAudio, 
  toggleVideo,
  applyVideoConstraints,
  switchCamera,
  setFacingMode, // 🔑 设置摄像头朝向
  switchVideoMode, // 🎬 切换视频模式
} = useMediaStream()

// WebRTC + DataChannel
const { 
  peers, 
  updateAllPeerTracks, 
  maintainResolution, 
  setMaintainResolution,
  // 🔑 P2P 消息功能
  broadcastMessage,
  onMessage,
  offMessage,
} = useWebRTC(roomId, localStream)

// 计算属性：peers 转数组
const peersArray = computed(() => {
  return Array.from(peers.value.entries()).map(([id, data]) => ({
    id,
    ...data
  }))
})

// ========== P2P 消息监听（使用 DataChannel）==========
let chatListenerSetup = false

const handleChatMessage = (msg: ChatMessage) => {
  roomStore.addMessage(msg)
  // 如果聊天面板没打开，增加未读计数
  if (!showChat.value) {
    unreadCount.value++
  }
  console.log('💬 [P2P] Message received:', msg.content)
}

const setupChatListener = () => {
  if (chatListenerSetup) return
  // 🔑 使用 DataChannel 的 onMessage 注册回调
  onMessage(handleChatMessage)
  chatListenerSetup = true
  console.log('📨 [P2P] Room chat listener setup')
}

const cleanupChatListener = () => {
  offMessage(handleChatMessage)
  chatListenerSetup = false
}

// 🔑 发送消息（P2P 广播 + 本地显示）
const sendChatMessage = (content: string) => {
  const myId = socketStore.socket?.id || 'local'
  const message: ChatMessage = {
    id: `${Date.now()}-${myId}`,
    from: myId,
    nickname: roomStore.nickname || '我',
    content,
    timestamp: Date.now(),
  }
  
  // 本地立即显示
  roomStore.addMessage(message)
  
  // P2P 广播给所有 Peer
  broadcastMessage(message)
}

// 打开聊天时清除未读
watch(showChat, (isOpen) => {
  if (isOpen) {
    unreadCount.value = 0
  }
})

// 加入房间
const joinRoom = async () => {
  // 尝试获取媒体流（失败也继续）
  try {
    await startMedia(true, true)
  } catch (err) {
    console.warn('⚠️ 无法获取媒体设备，将以纯文字模式加入')
  }
  
  // 🔑 设置 P2P 消息监听（DataChannel）
  setupChatListener()
  
  // 加入房间
  socketStore.socket?.emit('join-room', {
    roomId,
    nickname: roomStore.nickname || '匿名用户'
  }, (response: any) => {
    if (response.success) {
      isJoined.value = true
      roomStore.setRoom(response.roomInfo)
      console.log('✅ Joined room:', roomId)
    } else {
      errorMsg.value = response.error || '加入房间失败'
      stopMedia()
    }
  })
}

// 离开房间
const leaveRoom = () => {
  socketStore.socket?.emit('leave-room', { roomId })
  stopMedia()
  roomStore.clearRoom()
  router.push('/')
}

// 通知媒体状态变更
const handleToggleAudio = async () => {
  const success = await toggleAudio()
  if (success) {
    // 更新所有 Peer 的媒体轨道
    await updateAllPeerTracks()
    // 通知其他人媒体状态变化
    socketStore.socket?.emit('media-state', {
      roomId,
      isAudioEnabled: isAudioEnabled.value,
      isVideoEnabled: isVideoEnabled.value,
    })
  }
}

const handleToggleVideo = async () => {
  const success = await toggleVideo()
  if (success) {
    // 更新所有 Peer 的媒体轨道
    await updateAllPeerTracks()
    // 通知其他人媒体状态变化
    socketStore.socket?.emit('media-state', {
      roomId,
      isAudioEnabled: isAudioEnabled.value,
      isVideoEnabled: isVideoEnabled.value,
    })
  }
}

// 切换前后置摄像头
const handleSwitchCamera = async () => {
  const success = await switchCamera()
  if (success) {
    await updateAllPeerTracks()
  }
}

// 🎬 切换视频模式（4K清晰 / 流畅）
const handleSwitchVideoMode = async () => {
  const newMode = videoMode.value === 'quality' ? 'smooth' : 'quality'
  console.log(`🎬 Switching video mode to: ${newMode}`)
  
  // 1. 切换媒体流的视频约束
  const success = await switchVideoMode()
  if (success) {
    // 2. 同步更新 WebRTC 的分辨率保持策略
    await setMaintainResolution(newMode === 'quality')
    // 3. 更新所有 Peer 的媒体轨道
    await updateAllPeerTracks()
    console.log(`🎬 Video mode switched to: ${newMode}`)
  }
}

// 应用摄像头设置
const handleApplyCameraSettings = async (constraints: MediaTrackConstraints, facingMode: 'user' | 'environment') => {
  // 🔑 同步更新 facingMode
  setFacingMode(facingMode)
  
  const success = await applyVideoConstraints(constraints)
  if (success) {
    await updateAllPeerTracks()
  }
}

// 更新保持分辨率设置
const handleMaintainResolutionChange = async (value: boolean) => {
  await setMaintainResolution(value)
}

// 打开设置
const openCameraSettings = () => {
  showCameraSettings.value = true
}

onMounted(() => {
  if (!roomStore.nickname) {
    // 如果没有昵称，先回首页设置
    router.push('/')
    return
  }
  joinRoom()
})

onUnmounted(() => {
  cleanupChatListener()
  leaveRoom()
})
</script>

<template>
  <div class="h-screen flex flex-col bg-gray-950">
    <!-- 顶部栏 -->
    <header class="flex items-center justify-between px-4 py-3 bg-gray-900/80 border-b border-gray-800">
      <div class="flex items-center gap-3">
        <span class="text-xl">📹</span>
        <div>
          <h1 class="text-white font-medium">房间: {{ roomId }}</h1>
          <p class="text-xs text-gray-400">{{ peersArray.length + 1 }} 人在线</p>
        </div>
      </div>
      <div class="flex items-center gap-2">
        <button 
          @click="showChat = !showChat"
          class="p-2 rounded-lg hover:bg-gray-800 text-gray-400 hover:text-white transition relative"
        >
          💬
          <!-- 未读消息红点 -->
          <span 
            v-if="unreadCount > 0" 
            class="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full min-w-5 h-5 flex items-center justify-center px-1"
          >
            {{ unreadCount > 99 ? '99+' : unreadCount }}
          </span>
        </button>
      </div>
    </header>

    <!-- 错误提示 -->
    <div v-if="errorMsg" class="p-4 bg-red-500/20 text-red-400 text-center">
      {{ errorMsg }}
      <button @click="router.push('/')" class="underline ml-2">返回首页</button>
    </div>

    <!-- 主内容区 -->
    <div class="flex-1 flex overflow-hidden">
      <!-- 视频区域 -->
      <div class="flex-1 relative">
        <VideoGrid
          v-if="isJoined"
          :local-stream="localStream"
          :local-nickname="roomStore.nickname"
          :local-facing-mode="currentFacingMode"
          :peers="peers"
          :is-audio-enabled="isAudioEnabled"
          :is-video-enabled="isVideoEnabled"
        />
        
        <!-- 未加入时的加载状态 -->
        <div v-else class="flex items-center justify-center h-full">
          <div class="text-center">
            <div class="animate-spin text-4xl mb-4">⏳</div>
            <p class="text-gray-400">正在加入房间...</p>
          </div>
        </div>
      </div>

      <!-- 聊天面板 -->
      <div 
        v-if="showChat" 
        class="w-80 border-l border-gray-800 bg-gray-900"
      >
        <ChatPanel :room-id="roomId" @send-message="sendChatMessage" />
      </div>
    </div>

    <!-- 控制栏 -->
    <Controls
      v-if="isJoined"
      :is-audio-enabled="isAudioEnabled"
      :is-video-enabled="isVideoEnabled"
      :is-mobile="isMobile"
      :video-mode="videoMode"
      @toggle-audio="handleToggleAudio"
      @toggle-video="handleToggleVideo"
      @switch-camera="handleSwitchCamera"
      @switch-video-mode="handleSwitchVideoMode"
      @open-settings="openCameraSettings"
      @leave-room="leaveRoom"
    />

    <!-- 摄像头设置弹窗 -->
    <CameraSettings
      :show="showCameraSettings"
      :maintain-resolution="maintainResolution"
      @close="showCameraSettings = false"
      @apply="handleApplyCameraSettings"
      @update:maintain-resolution="handleMaintainResolutionChange"
    />
  </div>
</template>


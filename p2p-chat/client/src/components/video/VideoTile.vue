<script setup lang="ts">
import { ref, watch, onMounted, onUnmounted, computed } from 'vue'
import type { WebRTCStats } from '@/types'

interface Props {
  stream: MediaStream | null
  muted?: boolean
  nickname: string
  isLocal?: boolean
  facingMode?: 'user' | 'environment' // 🔑 摄像头朝向（前置/后置）
  isAudioEnabled?: boolean
  isVideoEnabled?: boolean
  stats?: WebRTCStats
}

const props = withDefaults(defineProps<Props>(), {
  muted: false,
  isLocal: false,
  facingMode: 'user',
  isAudioEnabled: true,
  isVideoEnabled: true,
})

// 🔑 只有本地视频 + 前置摄像头才需要镜像
const shouldMirror = computed(() => {
  return props.isLocal && props.facingMode === 'user'
})

const videoRef = ref<HTMLVideoElement | null>(null)

// 视频统计信息
const videoWidth = ref(0)
const videoHeight = ref(0)
const currentFps = ref(0)
const frameRate = ref(0)

let statsInterval: number | null = null
let lastFrameCount = 0
let lastTime = 0

// 格式化比特率显示
const formatBitrate = (bps: number): string => {
  if (bps >= 1_000_000) {
    return `${(bps / 1_000_000).toFixed(1)} Mbps`
  } else if (bps >= 1_000) {
    return `${(bps / 1_000).toFixed(0)} Kbps`
  }
  return `${bps} bps`
}

// 获取连接类型的显示文字和颜色
const connectionInfo = computed(() => {
  if (!props.stats) return { text: '未知', color: 'text-gray-400', icon: '❓' }
  
  switch (props.stats.connectionType) {
    case 'host':
      return { text: '直连', color: 'text-green-400', icon: '🟢' }
    case 'srflx':
      return { text: 'STUN', color: 'text-blue-400', icon: '🔵' }
    case 'prflx':
      return { text: '对等', color: 'text-cyan-400', icon: '🔷' }
    case 'relay':
      return { text: 'TURN中继', color: 'text-yellow-400', icon: '🟡' }
    default:
      return { text: '未知', color: 'text-gray-400', icon: '❓' }
  }
})

// 丢包率颜色
const packetLossColor = computed(() => {
  if (!props.stats) return 'text-gray-400'
  const loss = props.stats.packetsLostPercent
  if (loss <= 1) return 'text-green-400'
  if (loss <= 5) return 'text-yellow-400'
  return 'text-red-400'
})

// 更新视频统计信息
const updateVideoStats = () => {
  if (!videoRef.value || !props.stream) return

  const video = videoRef.value
  
  // 获取实际显示的分辨率
  if (video.videoWidth && video.videoHeight) {
    videoWidth.value = video.videoWidth
    videoHeight.value = video.videoHeight
  }

  // 获取视频轨道的帧率设置
  const videoTrack = props.stream.getVideoTracks()[0]
  if (videoTrack) {
    const settings = videoTrack.getSettings()
    if (settings.frameRate) {
      frameRate.value = Math.round(settings.frameRate)
    }
  }

  // 计算实时FPS
  if ('requestVideoFrameCallback' in HTMLVideoElement.prototype) {
    calculateRealFps()
  }
}

// 计算实时帧率
const calculateRealFps = () => {
  if (!videoRef.value) return

  const video = videoRef.value as any
  
  video.requestVideoFrameCallback((now: number, metadata: any) => {
    if (lastTime > 0) {
      const frameCount = metadata.presentedFrames || 0
      const timeDiff = (now - lastTime) / 1000
      
      if (timeDiff > 0 && frameCount > lastFrameCount) {
        const fps = (frameCount - lastFrameCount) / timeDiff
        currentFps.value = Math.round(fps)
      }
    }
    
    lastFrameCount = metadata.presentedFrames || 0
    lastTime = now
    
    // 继续监听
    if (videoRef.value && props.stream) {
      video.requestVideoFrameCallback(calculateRealFps)
    }
  })
}

// 启动统计
const startStats = () => {
  setTimeout(updateVideoStats, 500)
  statsInterval = window.setInterval(updateVideoStats, 2000)
}

// 停止统计
const stopStats = () => {
  if (statsInterval) {
    clearInterval(statsInterval)
    statsInterval = null
  }
}

watch(() => props.stream, (newStream) => {
  if (videoRef.value && newStream) {
    console.log(`🎬 VideoTile [${props.nickname}] stream updated`)
    
    videoRef.value.srcObject = newStream
    videoRef.value.play().catch(err => {
      console.error(`❌ Video play error [${props.nickname}]:`, err)
    })
    
    // 重置统计
    videoWidth.value = 0
    videoHeight.value = 0
    currentFps.value = 0
    lastFrameCount = 0
    lastTime = 0
    startStats()
  }
}, { immediate: true })

onMounted(() => {
  if (videoRef.value && props.stream) {
    videoRef.value.srcObject = props.stream
    videoRef.value.play().catch(err => {
      console.error(`❌ Video play error on mount [${props.nickname}]:`, err)
    })
    startStats()
  }
})

onUnmounted(() => {
  stopStats()
})
</script>

<template>
  <div class="relative bg-gray-800 rounded-xl overflow-hidden aspect-video shadow-lg">
    <!-- 视频元素 -->
    <video
      ref="videoRef"
      autoplay
      playsinline
      :muted="muted"
      class="w-full h-full object-cover"
      :class="{ 'scale-x-[-1]': shouldMirror }"
    />
    
    <!-- 视频关闭时的占位 -->
    <div
      v-if="!isVideoEnabled || !stream"
      class="absolute inset-0 flex items-center justify-center bg-gray-800"
    >
      <div class="w-20 h-20 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
        <span class="text-3xl text-white font-bold">
          {{ nickname.charAt(0).toUpperCase() }}
        </span>
      </div>
    </div>

    <!-- 🔑 右上角详细统计信息 -->
    <div 
      v-if="stream && isVideoEnabled && !isLocal"
      class="absolute top-2 right-2 bg-black/80 rounded-lg px-2 py-1.5 text-xs font-mono space-y-0.5"
    >
      <!-- 分辨率和帧率 -->
      <div class="flex items-center justify-between gap-3 text-green-400">
        <span v-if="videoWidth > 0">{{ videoWidth }}×{{ videoHeight }}</span>
        <span>{{ currentFps > 0 ? currentFps : frameRate }}fps</span>
      </div>
      
      <!-- WebRTC 统计（仅远程流显示） -->
      <template v-if="stats">
        <div class="border-t border-gray-600 my-1"></div>
        
        <!-- 连接类型 -->
        <div class="flex items-center justify-between gap-2">
          <span class="text-gray-400">连接:</span>
          <span :class="connectionInfo.color">
            {{ connectionInfo.icon }} {{ connectionInfo.text }}
          </span>
        </div>
        
        <!-- 带宽 -->
        <div class="flex items-center justify-between gap-2">
          <span class="text-gray-400">带宽:</span>
          <span class="text-blue-400">{{ formatBitrate(stats.inboundBitrate) }}</span>
        </div>
        
        <!-- 丢包率 -->
        <div class="flex items-center justify-between gap-2">
          <span class="text-gray-400">丢包:</span>
          <span :class="packetLossColor">{{ stats.packetsLostPercent }}%</span>
        </div>
        
        <!-- 延迟 -->
        <div class="flex items-center justify-between gap-2">
          <span class="text-gray-400">延迟:</span>
          <span class="text-cyan-400">{{ stats.roundTripTime }}ms</span>
        </div>
      </template>
    </div>

    <!-- 本地视频的简单统计 -->
    <div 
      v-if="stream && isVideoEnabled && isLocal && videoWidth > 0"
      class="absolute top-2 right-2 bg-black/70 rounded px-2 py-1 text-xs font-mono"
    >
      <div class="flex flex-col items-end gap-0.5 text-green-400">
        <span>{{ videoWidth }}×{{ videoHeight }}</span>
        <span>{{ currentFps > 0 ? currentFps : frameRate }}fps</span>
      </div>
    </div>
    
    <!-- 底部信息栏 -->
    <div class="absolute bottom-0 left-0 right-0 p-3 bg-gradient-to-t from-black/80 to-transparent">
      <div class="flex items-center justify-between">
        <span class="text-white text-sm font-medium truncate">
          {{ nickname }}
          <span v-if="isLocal" class="text-blue-400 text-xs">(你)</span>
        </span>
        <div class="flex items-center gap-2">
          <span v-if="!isAudioEnabled" class="text-red-400 text-sm">🔇</span>
          <span v-if="!isVideoEnabled" class="text-red-400 text-sm">📷</span>
        </div>
      </div>
    </div>
  </div>
</template>

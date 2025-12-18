<script setup lang="ts">
import { ref, watch, onMounted } from 'vue'

interface Props {
  stream: MediaStream | null
  muted?: boolean
  nickname: string
  isLocal?: boolean
  isAudioEnabled?: boolean
  isVideoEnabled?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  muted: false,
  isLocal: false,
  isAudioEnabled: true,
  isVideoEnabled: true,
})

const videoRef = ref<HTMLVideoElement | null>(null)

watch(() => props.stream, (newStream) => {
  if (videoRef.value && newStream) {
    videoRef.value.srcObject = newStream
  }
}, { immediate: true })

onMounted(() => {
  if (videoRef.value && props.stream) {
    videoRef.value.srcObject = props.stream
  }
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
      :class="{ 'scale-x-[-1]': isLocal }"
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
    
    <!-- 底部信息栏 -->
    <div class="absolute bottom-0 left-0 right-0 p-3 bg-gradient-to-t from-black/80 to-transparent">
      <div class="flex items-center justify-between">
        <span class="text-white text-sm font-medium truncate">
          {{ nickname }}
          <span v-if="isLocal" class="text-blue-400 text-xs">(你)</span>
        </span>
        <div class="flex items-center gap-2">
          <!-- 静音图标 -->
          <span v-if="!isAudioEnabled" class="text-red-400 text-sm">🔇</span>
          <!-- 视频关闭图标 -->
          <span v-if="!isVideoEnabled" class="text-red-400 text-sm">📷</span>
        </div>
      </div>
    </div>
  </div>
</template>


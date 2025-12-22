<script setup lang="ts">
// 视频模式类型
type VideoMode = 'quality' | 'smooth'

interface Props {
  isAudioEnabled: boolean
  isVideoEnabled: boolean
  isMobile?: boolean
  videoMode?: VideoMode
}

const props = withDefaults(defineProps<Props>(), {
  isMobile: false,
  videoMode: 'quality',
})

const emit = defineEmits<{
  toggleAudio: []
  toggleVideo: []
  switchCamera: []
  openSettings: []
  leaveRoom: []
  switchVideoMode: []
}>()
</script>

<template>
  <div class="flex items-center justify-center gap-3 p-4 bg-gray-900 border-t border-gray-800">
    <!-- 麦克风按钮 -->
    <button
      @click="emit('toggleAudio')"
      :class="[
        'w-12 h-12 rounded-full flex items-center justify-center transition-all text-xl',
        isAudioEnabled 
          ? 'bg-gray-700 hover:bg-gray-600' 
          : 'bg-red-500 hover:bg-red-600'
      ]"
      :title="isAudioEnabled ? '关闭麦克风' : '开启麦克风'"
    >
      {{ isAudioEnabled ? '🎤' : '🔇' }}
    </button>

    <!-- 摄像头按钮 -->
    <button
      @click="emit('toggleVideo')"
      :class="[
        'w-12 h-12 rounded-full flex items-center justify-center transition-all text-xl',
        isVideoEnabled 
          ? 'bg-gray-700 hover:bg-gray-600' 
          : 'bg-red-500 hover:bg-red-600'
      ]"
      :title="isVideoEnabled ? '关闭摄像头' : '开启摄像头'"
    >
      {{ isVideoEnabled ? '📹' : '📷' }}
    </button>

    <!-- 切换前后置摄像头（仅移动端显示） -->
    <button
      v-if="isMobile"
      @click="emit('switchCamera')"
      class="w-12 h-12 rounded-full bg-gray-700 hover:bg-gray-600 flex items-center justify-center transition-all text-xl"
      title="切换摄像头"
    >
      🔄
    </button>

    <!-- 🎬 视频模式切换按钮 -->
    <button
      @click="emit('switchVideoMode')"
      :class="[
        'h-12 px-3 rounded-full flex items-center justify-center gap-1 transition-all text-sm font-medium',
        videoMode === 'quality' 
          ? 'bg-purple-600 hover:bg-purple-700 text-white' 
          : 'bg-green-600 hover:bg-green-700 text-white'
      ]"
      :title="videoMode === 'quality' ? '当前：4K清晰模式（点击切换到流畅模式）' : '当前：流畅模式（点击切换到4K清晰模式）'"
    >
      <span class="text-lg">{{ videoMode === 'quality' ? '🔒' : '🚀' }}</span>
      <span class="hidden sm:inline">{{ videoMode === 'quality' ? '4K' : '流畅' }}</span>
    </button>

    <!-- 设置按钮 -->
    <button
      @click="emit('openSettings')"
      class="w-12 h-12 rounded-full bg-gray-700 hover:bg-gray-600 flex items-center justify-center transition-all text-xl"
      title="摄像头设置"
    >
      ⚙️
    </button>

    <!-- 离开按钮 -->
    <button
      @click="emit('leaveRoom')"
      class="w-12 h-12 rounded-full bg-red-600 hover:bg-red-700 flex items-center justify-center transition-all text-xl"
      title="离开房间"
    >
      📞
    </button>
  </div>
</template>


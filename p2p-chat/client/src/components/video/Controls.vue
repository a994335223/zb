<script setup lang="ts">
interface Props {
  isAudioEnabled: boolean
  isVideoEnabled: boolean
}

defineProps<Props>()

const emit = defineEmits<{
  toggleAudio: []
  toggleVideo: []
  leaveRoom: []
}>()
</script>

<template>
  <div class="flex items-center justify-center gap-4 p-4 bg-gray-900 border-t border-gray-800">
    <!-- 麦克风按钮 -->
    <button
      @click="emit('toggleAudio')"
      :class="[
        'w-14 h-14 rounded-full flex items-center justify-center transition-all text-2xl',
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
        'w-14 h-14 rounded-full flex items-center justify-center transition-all text-2xl',
        isVideoEnabled 
          ? 'bg-gray-700 hover:bg-gray-600' 
          : 'bg-red-500 hover:bg-red-600'
      ]"
      :title="isVideoEnabled ? '关闭摄像头' : '开启摄像头'"
    >
      {{ isVideoEnabled ? '📹' : '📷' }}
    </button>

    <!-- 离开按钮 -->
    <button
      @click="emit('leaveRoom')"
      class="w-14 h-14 rounded-full bg-red-600 hover:bg-red-700 flex items-center justify-center transition-all text-2xl"
      title="离开房间"
    >
      📞
    </button>
  </div>
</template>


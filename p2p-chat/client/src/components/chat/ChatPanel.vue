<script setup lang="ts">
import { ref, nextTick, watch, onMounted } from 'vue'
import { useSocketStore } from '@/stores/socket'
import { useRoomStore } from '@/stores/room'

interface Props {
  roomId: string
}

const props = defineProps<Props>()

const socketStore = useSocketStore()
const roomStore = useRoomStore()
const messageInput = ref('')
const messagesContainer = ref<HTMLElement | null>(null)

// 发送消息
const sendMessage = () => {
  const content = messageInput.value.trim()
  if (!content) return

  socketStore.socket?.emit('chat-message', {
    roomId: props.roomId,
    content,
  })

  messageInput.value = ''
}

// 滚动到底部
const scrollToBottom = () => {
  nextTick(() => {
    if (messagesContainer.value) {
      messagesContainer.value.scrollTop = messagesContainer.value.scrollHeight
    }
  })
}

// 消息变化时滚动到底部
watch(() => roomStore.messages.length, () => {
  scrollToBottom()
})

// 组件挂载时滚动到底部（显示已有消息）
onMounted(() => {
  scrollToBottom()
})

// 格式化时间
const formatTime = (timestamp: number) => {
  return new Date(timestamp).toLocaleTimeString('zh-CN', { 
    hour: '2-digit', 
    minute: '2-digit' 
  })
}
</script>

<template>
  <div class="h-full flex flex-col">
    <!-- 标题 -->
    <div class="p-3 border-b border-gray-800">
      <h3 class="text-white font-medium">💬 聊天</h3>
    </div>

    <!-- 消息列表 -->
    <div 
      ref="messagesContainer"
      class="flex-1 overflow-y-auto p-3 space-y-3"
    >
      <div
        v-for="msg in roomStore.messages"
        :key="msg.id"
        class="flex flex-col"
      >
        <div class="flex items-center gap-2 mb-1">
          <span class="text-blue-400 text-sm font-medium">{{ msg.nickname }}</span>
          <span class="text-gray-500 text-xs">{{ formatTime(msg.timestamp) }}</span>
        </div>
        <p class="text-white text-sm bg-gray-800 rounded-lg px-3 py-2 max-w-full break-words">
          {{ msg.content }}
        </p>
      </div>

      <!-- 无消息提示 -->
      <div v-if="!roomStore.messages.length" class="text-gray-500 text-center text-sm py-8">
        暂无消息，发送一条吧 👋
      </div>
    </div>

    <!-- 输入区域 -->
    <div class="p-3 border-t border-gray-800">
      <div class="flex gap-2">
        <input
          v-model="messageInput"
          @keyup.enter="sendMessage"
          type="text"
          placeholder="输入消息..."
          class="flex-1 px-3 py-2 rounded-lg bg-gray-800 text-white border border-gray-700 focus:outline-none focus:border-blue-500 text-sm"
          maxlength="500"
        />
        <button
          @click="sendMessage"
          :disabled="!messageInput.trim()"
          class="px-4 py-2 rounded-lg bg-blue-500 text-white font-medium disabled:opacity-50 disabled:cursor-not-allowed hover:bg-blue-600 transition text-sm"
        >
          发送
        </button>
      </div>
    </div>
  </div>
</template>


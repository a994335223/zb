<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { useSocketStore } from '@/stores/socket'
import { useRoomStore } from '@/stores/room'

const router = useRouter()
const socketStore = useSocketStore()
const roomStore = useRoomStore()

const nickname = ref('')
const roomId = ref('')
const isCreating = ref(false)
const errorMsg = ref('')

// 生成随机房间ID
const generateRoomId = () => {
  return Math.random().toString(36).substring(2, 8).toUpperCase()
}

// 创建房间
const createRoom = () => {
  if (!nickname.value.trim()) {
    errorMsg.value = '请输入昵称'
    return
  }
  
  isCreating.value = true
  errorMsg.value = ''
  
  // 如果用户输入了房间号，使用用户输入的；否则生成随机房间号
  const targetRoomId = roomId.value.trim() 
    ? roomId.value.trim().toUpperCase() 
    : generateRoomId()
  
  roomStore.setNickname(nickname.value.trim())
  
  // 直接跳转到房间页面（房间会在 join-room 时自动创建）
  router.push(`/room/${targetRoomId}`)
  isCreating.value = false
}

// 加入房间
const joinRoom = () => {
  if (!nickname.value.trim()) {
    errorMsg.value = '请输入昵称'
    return
  }
  if (!roomId.value.trim()) {
    errorMsg.value = '请输入房间号'
    return
  }
  
  roomStore.setNickname(nickname.value.trim())
  router.push(`/room/${roomId.value.trim().toUpperCase()}`)
}
</script>

<template>
  <div class="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-gray-900 via-blue-900 to-gray-900">
    <div class="w-full max-w-md">
      <!-- Logo -->
      <div class="text-center mb-8">
        <div class="text-6xl mb-4">📹</div>
        <h1 class="text-3xl font-bold text-white mb-2">P2P 视频聊天</h1>
        <p class="text-gray-400">无服务器，端到端加密</p>
      </div>

      <!-- 卡片 -->
      <div class="bg-gray-800/50 backdrop-blur rounded-2xl p-6 shadow-xl border border-gray-700">
        <!-- 连接状态 -->
        <div class="flex items-center justify-center gap-2 mb-6">
          <div 
            class="w-2 h-2 rounded-full"
            :class="socketStore.isConnected ? 'bg-green-500' : 'bg-red-500'"
          ></div>
          <span class="text-sm text-gray-400">
            {{ socketStore.connectionStatus }}
          </span>
        </div>

        <!-- 表单 -->
        <div class="space-y-4">
          <!-- 昵称输入 -->
          <div>
            <label class="block text-sm text-gray-400 mb-1">昵称</label>
            <input
              v-model="nickname"
              type="text"
              placeholder="输入你的昵称"
              class="input-base"
              maxlength="20"
            />
          </div>

          <!-- 房间号输入 -->
          <div>
            <label class="block text-sm text-gray-400 mb-1">房间号 (加入已有房间)</label>
            <input
              v-model="roomId"
              type="text"
              placeholder="输入6位房间号"
              class="input-base uppercase"
              maxlength="6"
            />
          </div>

          <!-- 错误提示 -->
          <div v-if="errorMsg" class="text-red-400 text-sm text-center">
            {{ errorMsg }}
          </div>

          <!-- 按钮 -->
          <div class="flex gap-3 pt-2">
            <button
              @click="createRoom"
              :disabled="!socketStore.isConnected || isCreating"
              class="flex-1 btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {{ isCreating ? '创建中...' : '创建房间' }}
            </button>
            <button
              @click="joinRoom"
              :disabled="!socketStore.isConnected"
              class="flex-1 btn-secondary disabled:opacity-50 disabled:cursor-not-allowed"
            >
              加入房间
            </button>
          </div>
        </div>
      </div>

      <!-- 底部说明 -->
      <div class="text-center mt-6 text-gray-500 text-sm">
        <p>基于 WebRTC 技术，支持点对点视频通话</p>
      </div>
    </div>
  </div>
</template>


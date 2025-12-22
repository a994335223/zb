import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { io, Socket } from 'socket.io-client'
import { SOCKET_URL } from '@/config/ice'

export const useSocketStore = defineStore('socket', () => {
  // 状态
  const socket = ref<Socket | null>(null)
  const isConnected = ref(false)
  const socketId = ref<string>('')
  const socketUrl = ref('')

  // 计算属性
  const connectionStatus = computed(() => 
    isConnected.value ? '已连接' : '未连接'
  )

  // 连接
  const connect = () => {
    if (socket.value?.connected) return

    // 使用配置的 Socket URL
    socketUrl.value = SOCKET_URL
    console.log('🔌 Connecting to:', socketUrl.value)
    
    socket.value = io(socketUrl.value, {
      transports: ['websocket', 'polling'],
      autoConnect: true,
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
    })

    socket.value.on('connect', () => {
      isConnected.value = true
      socketId.value = socket.value?.id || ''
      console.log('✅ Socket connected:', socketId.value)
    })

    socket.value.on('disconnect', () => {
      isConnected.value = false
      socketId.value = ''
      console.log('❌ Socket disconnected')
    })

    socket.value.on('connect_error', (error) => {
      console.error('⚠️ Socket connection error:', error.message)
    })
  }

  // 断开连接
  const disconnect = () => {
    if (socket.value) {
      socket.value.disconnect()
      socket.value = null
      isConnected.value = false
      socketId.value = ''
    }
  }

  return {
    socket,
    isConnected,
    socketId,
    connectionStatus,
    connect,
    disconnect,
  }
})


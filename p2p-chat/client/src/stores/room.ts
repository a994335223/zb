import { defineStore } from 'pinia'
import { ref } from 'vue'
import type { RoomInfo, ChatMessage, UserInfo } from '@/types'

export const useRoomStore = defineStore('room', () => {
  // 状态
  const currentRoom = ref<RoomInfo | null>(null)
  const nickname = ref('')
  const messages = ref<ChatMessage[]>([])
  const users = ref<Map<string, UserInfo>>(new Map())

  // 设置房间
  const setRoom = (room: RoomInfo) => {
    currentRoom.value = room
  }

  // 设置昵称
  const setNickname = (name: string) => {
    nickname.value = name
  }

  // 添加消息
  const addMessage = (msg: ChatMessage) => {
    messages.value.push(msg)
    // 保留最近100条消息
    if (messages.value.length > 100) {
      messages.value.shift()
    }
  }

  // 添加用户
  const addUser = (user: UserInfo) => {
    users.value.set(user.id, user)
  }

  // 移除用户
  const removeUser = (userId: string) => {
    users.value.delete(userId)
  }

  // 清空房间
  const clearRoom = () => {
    currentRoom.value = null
    messages.value = []
    users.value.clear()
  }

  return {
    currentRoom,
    nickname,
    messages,
    users,
    setRoom,
    setNickname,
    addMessage,
    addUser,
    removeUser,
    clearRoom,
  }
})


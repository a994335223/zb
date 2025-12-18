import express from 'express'
import { createServer } from 'http'
import { Server } from 'socket.io'
import cors from 'cors'

const app = express()
const httpServer = createServer(app)

// CORS 配置
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST'],
}))

// Socket.io 配置
const io = new Server(httpServer, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST'],
  },
})

// 房间数据结构
interface Room {
  id: string
  name: string
  users: Map<string, UserInfo>
  createdAt: Date
}

interface UserInfo {
  id: string
  nickname: string
  isAudioEnabled: boolean
  isVideoEnabled: boolean
}

// 房间存储
const rooms = new Map<string, Room>()

// 生成房间ID
const generateRoomId = () => {
  return Math.random().toString(36).substring(2, 8).toUpperCase()
}

// Socket.io 事件处理
io.on('connection', (socket) => {
  console.log(`✅ Client connected: ${socket.id}`)

  // 创建房间
  socket.on('create-room', ({ name, nickname }, callback) => {
    const roomId = generateRoomId()
    const room: Room = {
      id: roomId,
      name: name || `${nickname}的房间`,
      users: new Map(),
      createdAt: new Date(),
    }
    rooms.set(roomId, room)
    console.log(`🏠 Room created: ${roomId}`)
    
    callback({ success: true, roomId })
  })

  // 加入房间
  socket.on('join-room', ({ roomId, nickname }, callback) => {
    let room = rooms.get(roomId)
    
    // 如果房间不存在，自动创建
    if (!room) {
      room = {
        id: roomId,
        name: `房间 ${roomId}`,
        users: new Map(),
        createdAt: new Date(),
      }
      rooms.set(roomId, room)
      console.log(`🏠 Room auto-created: ${roomId}`)
    }

    const userInfo: UserInfo = {
      id: socket.id,
      nickname: nickname || '匿名用户',
      isAudioEnabled: true,
      isVideoEnabled: true,
    }

    room.users.set(socket.id, userInfo)
    socket.join(roomId)
    
    // 通知房间其他人
    socket.to(roomId).emit('user-joined', { 
      userId: socket.id, 
      userInfo 
    })
    
    // 发送房间现有用户列表
    const existingUsers = Array.from(room.users.keys()).filter(id => id !== socket.id)
    socket.emit('room-users', { users: existingUsers })

    console.log(`👤 User ${socket.id} (${nickname}) joined room ${roomId}`)

    callback({ 
      success: true, 
      roomInfo: {
        id: room.id,
        name: room.name,
        userCount: room.users.size,
      }
    })
  })

  // 离开房间
  socket.on('leave-room', ({ roomId }) => {
    handleUserLeave(socket, roomId)
  })

  // WebRTC 信令
  socket.on('signal', ({ to, roomId, payload, type }) => {
    console.log(`📨 Signal ${type}: ${socket.id} -> ${to}`)
    io.to(to).emit('signal', {
      from: socket.id,
      payload,
      type,
    })
  })

  // 聊天消息
  socket.on('chat-message', ({ roomId, content }) => {
    const room = rooms.get(roomId)
    const userInfo = room?.users.get(socket.id)
    
    const message = {
      id: `${Date.now()}-${socket.id}`,
      from: socket.id,
      nickname: userInfo?.nickname || '匿名',
      content,
      timestamp: Date.now(),
    }
    
    io.to(roomId).emit('chat-message', message)
    console.log(`💬 Chat in ${roomId}: ${userInfo?.nickname}: ${content}`)
  })

  // 媒体状态变更
  socket.on('media-state', ({ roomId, isAudioEnabled, isVideoEnabled }) => {
    const room = rooms.get(roomId)
    const userInfo = room?.users.get(socket.id)
    
    if (userInfo) {
      userInfo.isAudioEnabled = isAudioEnabled
      userInfo.isVideoEnabled = isVideoEnabled
      
      socket.to(roomId).emit('user-media-state', {
        userId: socket.id,
        isAudioEnabled,
        isVideoEnabled,
      })
    }
  })

  // 断开连接
  socket.on('disconnect', () => {
    console.log(`❌ Client disconnected: ${socket.id}`)
    
    // 从所有房间移除用户
    rooms.forEach((room, roomId) => {
      if (room.users.has(socket.id)) {
        handleUserLeave(socket, roomId)
      }
    })
  })
})

// 处理用户离开
function handleUserLeave(socket: any, roomId: string) {
  const room = rooms.get(roomId)
  if (!room) return

  room.users.delete(socket.id)
  socket.leave(roomId)
  
  // 通知其他人
  socket.to(roomId).emit('user-left', { userId: socket.id })
  
  console.log(`👋 User ${socket.id} left room ${roomId}`)

  // 清理空房间
  if (room.users.size === 0) {
    rooms.delete(roomId)
    console.log(`🗑️ Empty room ${roomId} deleted`)
  }
}

// 健康检查
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok',
    rooms: rooms.size,
    connections: io.engine.clientsCount,
  })
})

// 启动服务器
const PORT = process.env.PORT || 3001
const HOST = '0.0.0.0' // 监听所有网卡，允许局域网访问

httpServer.listen(Number(PORT), HOST, () => {
  console.log(`
🚀 P2P Chat 信令服务器已启动！

   本地地址: http://localhost:${PORT}
   局域网地址: http://0.0.0.0:${PORT}
   健康检查: http://localhost:${PORT}/health
   
   等待客户端连接...
  `)
})


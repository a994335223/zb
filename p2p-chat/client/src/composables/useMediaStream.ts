import { ref, computed, onUnmounted } from 'vue'

// 🎬 视频模式类型
export type VideoMode = 'quality' | 'smooth'

// 4K清晰模式约束 - 优先保持分辨率
const QUALITY_MODE_CONSTRAINTS: MediaTrackConstraints = {
  width: { ideal: 3840 },    // 4K
  height: { ideal: 2160 },   // 4K
  frameRate: { ideal: 30 },
  facingMode: 'user',
}

// 流畅模式约束 - 优先保持帧率
const SMOOTH_MODE_CONSTRAINTS: MediaTrackConstraints = {
  width: { ideal: 1280, max: 1920 },   // 720p-1080p
  height: { ideal: 720, max: 1080 },
  frameRate: { ideal: 30, min: 24 },   // 保证至少24fps
  facingMode: 'user',
}

// 默认音频约束
const DEFAULT_AUDIO_CONSTRAINTS: MediaTrackConstraints = {
  echoCancellation: true,
  noiseSuppression: true,
  autoGainControl: true,
}

export function useMediaStream() {
  const stream = ref<MediaStream | null>(null)
  const isAudioEnabled = ref(false)
  const isVideoEnabled = ref(false)
  const error = ref<string | null>(null)
  const isRequesting = ref(false)
  
  // 🎬 视频模式: 'quality' = 4K清晰模式, 'smooth' = 流畅模式
  const videoMode = ref<VideoMode>('quality')
  const currentVideoConstraints = ref<MediaTrackConstraints>({ ...QUALITY_MODE_CONSTRAINTS })
  const currentFacingMode = ref<'user' | 'environment'>('user')

  // 是否有媒体流
  const hasStream = computed(() => !!stream.value)

  // 获取媒体流
  const startMedia = async (video = true, audio = true, videoConstraints?: MediaTrackConstraints) => {
    if (isRequesting.value) return null
    isRequesting.value = true
    error.value = null

    // 合并视频约束
    const finalVideoConstraints = videoConstraints 
      ? { ...currentVideoConstraints.value, ...videoConstraints }
      : currentVideoConstraints.value

    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: video ? finalVideoConstraints : false,
        audio: audio ? DEFAULT_AUDIO_CONSTRAINTS : false,
      })

      stream.value = mediaStream
      isAudioEnabled.value = audio
      isVideoEnabled.value = video

      // 更新当前约束
      if (videoConstraints) {
        currentVideoConstraints.value = { ...currentVideoConstraints.value, ...videoConstraints }
      }

      // 记录实际获取到的设置，并设置 contentHint
      const videoTrack = mediaStream.getVideoTracks()[0]
      if (videoTrack) {
        // 🔑 根据模式设置 contentHint
        // 'motion' = 流畅模式（带宽不足时降分辨率，保持帧率）
        // 'detail' = 清晰模式（带宽不足时降帧率，保持分辨率）
        if ('contentHint' in videoTrack) {
          const hint = videoMode.value === 'quality' ? 'detail' : 'motion'
          ;(videoTrack as any).contentHint = hint
          console.log(`🎬 Set contentHint = ${hint} (${videoMode.value} mode)`)
        }
        
        const settings = videoTrack.getSettings()
        console.log('📹 Media stream started:', {
          mode: videoMode.value,
          width: settings.width,
          height: settings.height,
          frameRate: settings.frameRate,
          facingMode: settings.facingMode,
        })
      }

      return mediaStream
    } catch (err) {
      error.value = err instanceof Error ? err.message : '无法访问媒体设备'
      console.error('❌ Media error:', error.value)
      throw err
    } finally {
      isRequesting.value = false
    }
  }

  // 应用新的视频约束（切换分辨率/摄像头）
  const applyVideoConstraints = async (constraints: MediaTrackConstraints): Promise<boolean> => {
    currentVideoConstraints.value = { ...currentVideoConstraints.value, ...constraints }
    console.log('📷 Applying constraints:', currentVideoConstraints.value)
    
    // 如果当前有视频流，重新获取
    if (stream.value && isVideoEnabled.value) {
      // 保存旧的轨道引用，稍后停止
      const oldVideoTracks = stream.value.getVideoTracks()
      console.log('📷 Old video tracks:', oldVideoTracks.length)
      
      try {
        const newVideoStream = await navigator.mediaDevices.getUserMedia({
          video: currentVideoConstraints.value,
        })
        
        const newVideoTrack = newVideoStream.getVideoTracks()[0]
        console.log('📷 New video track:', newVideoTrack.id.slice(0, 8), newVideoTrack.label)
        
        // 🔑 根据模式设置 contentHint
        if ('contentHint' in newVideoTrack) {
          const hint = videoMode.value === 'quality' ? 'detail' : 'motion'
          ;(newVideoTrack as any).contentHint = hint
          console.log(`🎬 Set contentHint = ${hint}`)
        }
        
        // 先移除旧轨道，再添加新轨道
        oldVideoTracks.forEach(track => {
          stream.value?.removeTrack(track)
          track.stop()
          console.log('📷 Removed old track:', track.id.slice(0, 8))
        })
        
        stream.value.addTrack(newVideoTrack)
        console.log('📷 Added new track to stream')
        
        // 记录新设置
        const settings = newVideoTrack.getSettings()
        console.log('📹 Video constraints applied:', {
          width: settings.width,
          height: settings.height,
          frameRate: settings.frameRate,
          facingMode: settings.facingMode,
          deviceId: settings.deviceId?.slice(0, 8),
        })
        
        // 🔑 更新 facingMode（从实际设置中获取）
        if (settings.facingMode === 'user' || settings.facingMode === 'environment') {
          currentFacingMode.value = settings.facingMode
        }
        
        return true
      } catch (err) {
        console.error('❌ Apply constraints error:', err)
        alert('无法应用新的摄像头设置: ' + (err instanceof Error ? err.message : '未知错误'))
        return false
      }
    }
    
    return true
  }

  // 切换前后置摄像头
  const switchCamera = async (): Promise<boolean> => {
    const newMode = currentFacingMode.value === 'user' ? 'environment' : 'user'
    currentFacingMode.value = newMode
    
    // 移除 deviceId，使用 facingMode
    const { deviceId, ...rest } = currentVideoConstraints.value as any
    currentVideoConstraints.value = { ...rest, facingMode: newMode }
    
    return applyVideoConstraints({ facingMode: newMode })
  }

  // 停止媒体流
  const stopMedia = () => {
    if (stream.value) {
      stream.value.getTracks().forEach((track) => track.stop())
      stream.value = null
      isAudioEnabled.value = false
      isVideoEnabled.value = false
      console.log('⏹️ Media stream stopped')
    }
  }

  // 切换音频（如果没有流则尝试获取）
  const toggleAudio = async () => {
    // 如果没有媒体流，尝试获取
    if (!stream.value) {
      try {
        await startMedia(isVideoEnabled.value, true)
        return true
      } catch {
        alert('无法访问麦克风，请检查权限设置')
        return false
      }
    }

    // 已有流，切换状态
    const audioTracks = stream.value.getAudioTracks()
    if (audioTracks.length === 0) {
      // 没有音频轨道，尝试添加
      try {
        const audioStream = await navigator.mediaDevices.getUserMedia({ audio: true })
        const audioTrack = audioStream.getAudioTracks()[0]
        stream.value.addTrack(audioTrack)
        isAudioEnabled.value = true
        console.log('🎤 Audio track added')
        return true
      } catch {
        alert('无法访问麦克风，请检查权限设置')
        return false
      }
    }

    audioTracks.forEach((track) => {
      track.enabled = !track.enabled
    })
    isAudioEnabled.value = !isAudioEnabled.value
    console.log('🎤 Audio:', isAudioEnabled.value ? 'ON' : 'OFF')
    return true
  }

  // 切换视频（如果没有流则尝试获取）
  const toggleVideo = async () => {
    // 如果没有媒体流，尝试获取
    if (!stream.value) {
      try {
        await startMedia(true, isAudioEnabled.value)
        return true
      } catch {
        alert('无法访问摄像头，请检查权限设置')
        return false
      }
    }

    // 已有流，切换状态
    const videoTracks = stream.value.getVideoTracks()
    if (videoTracks.length === 0) {
      // 没有视频轨道，尝试添加
      try {
        const videoStream = await navigator.mediaDevices.getUserMedia({ 
          video: currentVideoConstraints.value 
        })
        const videoTrack = videoStream.getVideoTracks()[0]
        stream.value.addTrack(videoTrack)
        isVideoEnabled.value = true
        console.log('📷 Video track added')
        return true
      } catch {
        alert('无法访问摄像头，请检查权限设置')
        return false
      }
    }

    videoTracks.forEach((track) => {
      track.enabled = !track.enabled
    })
    isVideoEnabled.value = !isVideoEnabled.value
    console.log('📷 Video:', isVideoEnabled.value ? 'ON' : 'OFF')
    return true
  }

  // 组件卸载时清理
  onUnmounted(() => {
    stopMedia()
  })

  // 🔑 设置 facingMode（供外部调用）
  const setFacingMode = (mode: 'user' | 'environment') => {
    currentFacingMode.value = mode
    console.log('📷 FacingMode set to:', mode === 'user' ? '前置' : '后置')
  }

  // 🎬 切换视频模式
  const switchVideoMode = async (): Promise<boolean> => {
    const newMode: VideoMode = videoMode.value === 'quality' ? 'smooth' : 'quality'
    videoMode.value = newMode
    
    // 获取对应模式的约束
    const modeConstraints = newMode === 'quality' 
      ? QUALITY_MODE_CONSTRAINTS 
      : SMOOTH_MODE_CONSTRAINTS
    
    // 保留当前的 facingMode
    const newConstraints = {
      ...modeConstraints,
      facingMode: currentFacingMode.value,
    }
    
    console.log(`🎬 Switching to ${newMode} mode:`, newConstraints)
    
    // 应用新约束
    const success = await applyVideoConstraints(newConstraints)
    
    if (success) {
      // 更新视频轨道的 contentHint
      const videoTrack = stream.value?.getVideoTracks()[0]
      if (videoTrack && 'contentHint' in videoTrack) {
        const hint = newMode === 'quality' ? 'detail' : 'motion'
        ;(videoTrack as any).contentHint = hint
        console.log(`🎬 Updated contentHint = ${hint}`)
      }
    }
    
    return success
  }

  // 🎬 设置视频模式（不重新获取流，用于初始化）
  const setVideoMode = (mode: VideoMode) => {
    videoMode.value = mode
    const modeConstraints = mode === 'quality' 
      ? QUALITY_MODE_CONSTRAINTS 
      : SMOOTH_MODE_CONSTRAINTS
    currentVideoConstraints.value = {
      ...modeConstraints,
      facingMode: currentFacingMode.value,
    }
    console.log(`🎬 Video mode set to: ${mode}`)
  }

  return {
    stream,
    isAudioEnabled,
    isVideoEnabled,
    hasStream,
    error,
    isRequesting,
    currentFacingMode,
    currentVideoConstraints,
    videoMode,
    startMedia,
    stopMedia,
    toggleAudio,
    toggleVideo,
    applyVideoConstraints,
    switchCamera,
    setFacingMode,
    switchVideoMode,
    setVideoMode,
  }
}


import { ref, computed, onUnmounted } from 'vue'

export function useMediaStream() {
  const stream = ref<MediaStream | null>(null)
  const isAudioEnabled = ref(false)
  const isVideoEnabled = ref(false)
  const error = ref<string | null>(null)
  const isRequesting = ref(false)

  // 是否有媒体流
  const hasStream = computed(() => !!stream.value)

  // 获取媒体流
  const startMedia = async (video = true, audio = true) => {
    if (isRequesting.value) return null
    isRequesting.value = true
    error.value = null

    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: video ? {
          width: { ideal: 1280 },
          height: { ideal: 720 },
          facingMode: 'user',
        } : false,
        audio: audio ? {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        } : false,
      })

      stream.value = mediaStream
      isAudioEnabled.value = audio
      isVideoEnabled.value = video

      console.log('📹 Media stream started')
      return mediaStream
    } catch (err) {
      error.value = err instanceof Error ? err.message : '无法访问媒体设备'
      console.error('❌ Media error:', error.value)
      throw err
    } finally {
      isRequesting.value = false
    }
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
          video: { facingMode: 'user' } 
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

  return {
    stream,
    isAudioEnabled,
    isVideoEnabled,
    hasStream,
    error,
    isRequesting,
    startMedia,
    stopMedia,
    toggleAudio,
    toggleVideo,
  }
}


import { ref, computed } from 'vue'

// 摄像头信息
export interface CameraDevice {
  deviceId: string
  label: string
  facingMode?: 'user' | 'environment'
}

// 分辨率预设
export interface Resolution {
  width: number
  height: number
  label: string
}

// 常用分辨率预设
export const RESOLUTION_PRESETS: Resolution[] = [
  { width: 3840, height: 2160, label: '4K (3840×2160)' },
  { width: 1920, height: 1080, label: '1080p (1920×1080)' },
  { width: 1280, height: 720, label: '720p (1280×720)' },
  { width: 854, height: 480, label: '480p (854×480)' },
  { width: 640, height: 360, label: '360p (640×360)' },
]

// 帧率预设
export const FRAMERATE_PRESETS = [60, 30, 24, 15]

export function useCamera() {
  const cameras = ref<CameraDevice[]>([])
  const currentCameraId = ref<string>('')
  const currentFacingMode = ref<'user' | 'environment'>('user')
  const supportedResolutions = ref<Resolution[]>([])
  const maxResolution = ref<Resolution | null>(null)
  const maxFrameRate = ref<number>(30)
  const selectedResolution = ref<Resolution>(RESOLUTION_PRESETS[2]) // 默认720p
  const selectedFrameRate = ref<number>(30)
  const isLoading = ref(false)
  
  // 🔑 关键：是否保持分辨率不降级（默认开启）
  // maintain-resolution: 带宽不足时降帧率，不降分辨率
  // maintain-framerate: 带宽不足时降分辨率，不降帧率
  // balanced: 平衡（默认WebRTC行为）
  const maintainResolution = ref<boolean>(true)

  // 是否为移动设备
  const isMobile = computed(() => {
    return /Android|iPhone|iPad|iPod/i.test(navigator.userAgent)
  })

  // 获取所有摄像头设备
  const getCameras = async (): Promise<CameraDevice[]> => {
    try {
      // 先请求权限
      const tempStream = await navigator.mediaDevices.getUserMedia({ video: true })
      tempStream.getTracks().forEach(track => track.stop())

      const devices = await navigator.mediaDevices.enumerateDevices()
      const videoDevices = devices.filter(d => d.kind === 'videoinput')
      
      cameras.value = videoDevices.map((device, index) => {
        // 尝试判断前后置
        let facingMode: 'user' | 'environment' | undefined
        const label = device.label.toLowerCase()
        if (label.includes('front') || label.includes('前') || label.includes('user')) {
          facingMode = 'user'
        } else if (label.includes('back') || label.includes('rear') || label.includes('后') || label.includes('environment')) {
          facingMode = 'environment'
        } else if (isMobile.value) {
          // 移动设备：第一个通常是前置，第二个是后置
          facingMode = index === 0 ? 'user' : 'environment'
        }

        return {
          deviceId: device.deviceId,
          label: device.label || `摄像头 ${index + 1}`,
          facingMode,
        }
      })

      console.log('📷 Found cameras:', cameras.value)
      return cameras.value
    } catch (err) {
      console.error('❌ Get cameras error:', err)
      return []
    }
  }

  // 获取摄像头支持的分辨率
  const getCameraCapabilities = async (deviceId?: string): Promise<void> => {
    isLoading.value = true
    try {
      const constraints: MediaStreamConstraints = {
        video: deviceId 
          ? { deviceId: { exact: deviceId } }
          : { facingMode: currentFacingMode.value }
      }

      const stream = await navigator.mediaDevices.getUserMedia(constraints)
      const videoTrack = stream.getVideoTracks()[0]
      
      if (videoTrack) {
        const capabilities = videoTrack.getCapabilities?.()
        const settings = videoTrack.getSettings()

        console.log('📊 Camera capabilities:', capabilities)
        console.log('📊 Camera settings:', settings)

        if (capabilities) {
          // 获取最大分辨率
          const maxWidth = capabilities.width?.max || 1920
          const maxHeight = capabilities.height?.max || 1080
          const maxFps = capabilities.frameRate?.max || 30

          maxResolution.value = {
            width: maxWidth,
            height: maxHeight,
            label: `最大 (${maxWidth}×${maxHeight})`
          }
          maxFrameRate.value = maxFps

          // 筛选出支持的预设分辨率
          supportedResolutions.value = RESOLUTION_PRESETS.filter(
            res => res.width <= maxWidth && res.height <= maxHeight
          )

          // 添加最大分辨率选项（如果不在预设中）
          const hasMax = supportedResolutions.value.some(
            r => r.width === maxWidth && r.height === maxHeight
          )
          if (!hasMax) {
            supportedResolutions.value.unshift(maxResolution.value)
          }

          console.log('📊 Supported resolutions:', supportedResolutions.value)
          console.log('📊 Max frame rate:', maxFps)
        }
      }

      // 停止临时流
      stream.getTracks().forEach(track => track.stop())
    } catch (err) {
      console.error('❌ Get capabilities error:', err)
      // 使用默认值
      supportedResolutions.value = RESOLUTION_PRESETS.slice(1) // 排除4K
      maxFrameRate.value = 30
    } finally {
      isLoading.value = false
    }
  }

  // 切换前后置摄像头
  const switchCamera = async (): Promise<'user' | 'environment'> => {
    const newMode = currentFacingMode.value === 'user' ? 'environment' : 'user'
    currentFacingMode.value = newMode
    console.log('🔄 Switched to:', newMode === 'user' ? '前置' : '后置')
    return newMode
  }

  // 选择指定摄像头
  const selectCamera = (deviceId: string) => {
    currentCameraId.value = deviceId
    const camera = cameras.value.find(c => c.deviceId === deviceId)
    if (camera?.facingMode) {
      currentFacingMode.value = camera.facingMode
    }
  }

  // 选择分辨率
  const selectResolution = (resolution: Resolution) => {
    selectedResolution.value = resolution
    console.log('📐 Selected resolution:', resolution.label)
  }

  // 选择帧率
  const selectFrameRate = (fps: number) => {
    selectedFrameRate.value = fps
    console.log('🎬 Selected frame rate:', fps)
  }

  // 使用最大分辨率和帧率
  const useMaxQuality = () => {
    if (maxResolution.value) {
      selectedResolution.value = maxResolution.value
    }
    selectedFrameRate.value = maxFrameRate.value
    console.log('🚀 Using max quality:', selectedResolution.value, selectedFrameRate.value + 'fps')
  }

  // 切换是否保持分辨率
  const toggleMaintainResolution = (value?: boolean) => {
    maintainResolution.value = value !== undefined ? value : !maintainResolution.value
    console.log('🔒 Maintain resolution:', maintainResolution.value ? '开启' : '关闭')
  }

  // 获取当前视频约束
  const getVideoConstraints = (): MediaTrackConstraints => {
    const constraints: MediaTrackConstraints = {
      width: { ideal: selectedResolution.value.width },
      height: { ideal: selectedResolution.value.height },
      frameRate: { ideal: selectedFrameRate.value },
    }

    if (currentCameraId.value) {
      constraints.deviceId = { exact: currentCameraId.value }
    } else {
      constraints.facingMode = currentFacingMode.value
    }

    return constraints
  }

  return {
    cameras,
    currentCameraId,
    currentFacingMode,
    supportedResolutions,
    maxResolution,
    maxFrameRate,
    selectedResolution,
    selectedFrameRate,
    maintainResolution,
    isMobile,
    isLoading,
    getCameras,
    getCameraCapabilities,
    switchCamera,
    selectCamera,
    selectResolution,
    selectFrameRate,
    useMaxQuality,
    toggleMaintainResolution,
    getVideoConstraints,
    RESOLUTION_PRESETS,
    FRAMERATE_PRESETS,
  }
}


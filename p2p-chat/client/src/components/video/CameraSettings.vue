<script setup lang="ts">
import { ref, onMounted, watch } from 'vue'
import { useCamera } from '@/composables/useCamera'

interface Props {
  show: boolean
  maintainResolution?: boolean // 是否保持分辨率
}

const props = withDefaults(defineProps<Props>(), {
  maintainResolution: true,
})

const emit = defineEmits<{
  close: []
  apply: [constraints: MediaTrackConstraints, facingMode: 'user' | 'environment']
  'update:maintainResolution': [value: boolean]
}>()

const {
  cameras,
  supportedResolutions,
  maxResolution,
  maxFrameRate,
  selectedResolution,
  selectedFrameRate,
  currentFacingMode, // 🔑 获取当前 facingMode
  isLoading,
  getCameras,
  getCameraCapabilities,
  selectCamera,
  selectResolution,
  selectFrameRate,
  useMaxQuality,
  getVideoConstraints,
  FRAMERATE_PRESETS,
} = useCamera()

// 本地状态
const localMaintainResolution = ref(props.maintainResolution)
const selectedCameraId = ref('')

// 同步外部值
watch(() => props.maintainResolution, (val) => {
  localMaintainResolution.value = val
})

// 切换保持分辨率
const toggleMaintainResolution = () => {
  localMaintainResolution.value = !localMaintainResolution.value
  emit('update:maintainResolution', localMaintainResolution.value)
}

// 初始化
onMounted(async () => {
  await getCameras()
  if (cameras.value.length > 0) {
    selectedCameraId.value = cameras.value[0].deviceId
    await getCameraCapabilities(cameras.value[0].deviceId)
  }
})

// 切换摄像头时重新获取能力
watch(selectedCameraId, async (newId) => {
  if (newId) {
    selectCamera(newId)
    await getCameraCapabilities(newId)
  }
})

// 应用设置
const handleApply = () => {
  const constraints = getVideoConstraints()
  console.log('📷 Applying constraints:', constraints, 'facingMode:', currentFacingMode.value)
  emit('apply', constraints, currentFacingMode.value) // 🔑 传递 facingMode
  emit('close')
}

// 使用最大质量
const handleUseMax = () => {
  useMaxQuality()
}
</script>

<template>
  <div 
    v-if="show" 
    class="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4"
    @click.self="emit('close')"
  >
    <div class="bg-gray-800 rounded-2xl w-full max-w-md max-h-[90vh] overflow-y-auto">
      <!-- 标题 -->
      <div class="flex items-center justify-between p-4 border-b border-gray-700">
        <h3 class="text-lg font-medium text-white">📷 摄像头设置</h3>
        <button 
          @click="emit('close')" 
          class="text-gray-400 hover:text-white text-xl"
        >
          ✕
        </button>
      </div>

      <div class="p-4 space-y-6">
        <!-- 加载中 -->
        <div v-if="isLoading" class="text-center py-8 text-gray-400">
          加载中...
        </div>

        <template v-else>
          <!-- 摄像头选择 -->
          <div>
            <label class="block text-sm text-gray-400 mb-2">选择摄像头</label>
            <select 
              v-model="selectedCameraId"
              class="w-full bg-gray-700 text-white rounded-lg px-3 py-2 border border-gray-600 focus:border-blue-500 focus:outline-none"
            >
              <option 
                v-for="camera in cameras" 
                :key="camera.deviceId" 
                :value="camera.deviceId"
              >
                {{ camera.label }}
                {{ camera.facingMode ? (camera.facingMode === 'user' ? '(前置)' : '(后置)') : '' }}
              </option>
            </select>
          </div>

          <!-- 分辨率选择 -->
          <div>
            <div class="flex items-center justify-between mb-2">
              <label class="text-sm text-gray-400">分辨率</label>
              <span v-if="maxResolution" class="text-xs text-green-400">
                最大支持: {{ maxResolution.width }}×{{ maxResolution.height }}
              </span>
            </div>
            <div class="grid grid-cols-2 gap-2">
              <button
                v-for="res in supportedResolutions"
                :key="`${res.width}x${res.height}`"
                @click="selectResolution(res)"
                :class="[
                  'px-3 py-2 rounded-lg text-sm transition',
                  selectedResolution.width === res.width && selectedResolution.height === res.height
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                ]"
              >
                {{ res.label }}
              </button>
            </div>
          </div>

          <!-- 帧率选择 -->
          <div>
            <div class="flex items-center justify-between mb-2">
              <label class="text-sm text-gray-400">帧率 (FPS)</label>
              <span class="text-xs text-green-400">
                最大支持: {{ maxFrameRate }}fps
              </span>
            </div>
            <div class="flex gap-2">
              <button
                v-for="fps in FRAMERATE_PRESETS.filter(f => f <= maxFrameRate)"
                :key="fps"
                @click="selectFrameRate(fps)"
                :class="[
                  'flex-1 px-3 py-2 rounded-lg text-sm transition',
                  selectedFrameRate === fps
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                ]"
              >
                {{ fps }}fps
              </button>
            </div>
          </div>

          <!-- 当前选择预览 -->
          <div class="bg-gray-900 rounded-lg p-3">
            <div class="text-sm text-gray-400 mb-1">当前设置</div>
            <div class="text-white">
              {{ selectedResolution.width }}×{{ selectedResolution.height }} @ {{ selectedFrameRate }}fps
            </div>
          </div>

          <!-- 🔑 保持分辨率开关 -->
          <div class="flex items-center justify-between bg-gray-900 rounded-lg p-3">
            <div class="flex-1 mr-3">
              <div class="text-white text-sm font-medium">🔒 保持分辨率不降级</div>
              <div class="text-xs text-gray-400 mt-1">
                {{ localMaintainResolution ? '带宽不足时降帧率，不降分辨率' : '允许自动调整分辨率（省流量）' }}
              </div>
            </div>
            <button
              @click="toggleMaintainResolution"
              :class="[
                'relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none',
                localMaintainResolution ? 'bg-green-500' : 'bg-gray-600'
              ]"
              role="switch"
              :aria-checked="localMaintainResolution"
            >
              <span
                :class="[
                  'pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out',
                  localMaintainResolution ? 'translate-x-5' : 'translate-x-0'
                ]"
              />
            </button>
          </div>

          <!-- 快捷按钮 -->
          <button
            @click="handleUseMax"
            class="w-full py-2 rounded-lg bg-green-600 hover:bg-green-700 text-white font-medium transition"
          >
            🚀 使用最高画质
          </button>
        </template>
      </div>

      <!-- 底部按钮 -->
      <div class="flex gap-3 p-4 border-t border-gray-700">
        <button
          @click="emit('close')"
          class="flex-1 py-2 rounded-lg bg-gray-700 hover:bg-gray-600 text-white transition"
        >
          取消
        </button>
        <button
          @click="handleApply"
          class="flex-1 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-medium transition"
        >
          应用设置
        </button>
      </div>
    </div>
  </div>
</template>


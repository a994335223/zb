<script setup lang="ts">
import { computed } from 'vue'
import VideoTile from './VideoTile.vue'
import type { PeerData } from '@/types'

interface Props {
  localStream: MediaStream | null
  localNickname: string
  peers: Map<string, PeerData>
  isAudioEnabled?: boolean
  isVideoEnabled?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  isAudioEnabled: true,
  isVideoEnabled: true,
})

const totalCount = computed(() => props.peers.size + 1)

const gridClass = computed(() => {
  const count = totalCount.value
  if (count <= 1) return 'grid-cols-1'
  if (count <= 2) return 'grid-cols-1 md:grid-cols-2'
  if (count <= 4) return 'grid-cols-2'
  if (count <= 6) return 'grid-cols-2 md:grid-cols-3'
  return 'grid-cols-3'
})

const peersArray = computed(() => Array.from(props.peers.entries()))
</script>

<template>
  <div class="h-full p-4">
    <div :class="['grid gap-4 h-full auto-rows-fr', gridClass]">
      <!-- 本地视频 -->
      <VideoTile
        :stream="localStream"
        :muted="true"
        :nickname="localNickname"
        :is-local="true"
        :is-audio-enabled="isAudioEnabled"
        :is-video-enabled="isVideoEnabled"
      />
      
      <!-- 远程视频 -->
      <VideoTile
        v-for="[peerId, peerData] in peersArray"
        :key="peerId"
        :stream="peerData.stream"
        :nickname="peerData.nickname"
        :is-audio-enabled="peerData.isAudioEnabled"
        :is-video-enabled="peerData.isVideoEnabled"
      />
    </div>
  </div>
</template>


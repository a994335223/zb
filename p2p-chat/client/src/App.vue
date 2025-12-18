<script setup lang="ts">
import { onMounted } from 'vue'
import { useSocketStore } from '@/stores/socket'

const socketStore = useSocketStore()

onMounted(() => {
  socketStore.connect()
})
</script>

<template>
  <div class="min-h-screen bg-gray-900 text-white">
    <router-view />
  </div>
</template>

<style>
* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}
</style>


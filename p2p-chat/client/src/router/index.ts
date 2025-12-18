import { createRouter, createWebHistory } from 'vue-router'
import Home from '@/views/Home.vue'
import Room from '@/views/Room.vue'

const router = createRouter({
  history: createWebHistory(),
  routes: [
    {
      path: '/',
      name: 'home',
      component: Home
    },
    {
      path: '/room/:roomId',
      name: 'room',
      component: Room
    }
  ]
})

export default router


/// <reference types="vite/client" />

declare module '*.vue' {
  import type { DefineComponent } from 'vue'
  const component: DefineComponent<{}, {}, any>
  export default component
}

interface ImportMetaEnv {
  readonly VITE_SOCKET_URL: string
  readonly VITE_STUN_URL: string
  readonly VITE_TURN_URL: string
  readonly VITE_TURN_USER: string
  readonly VITE_TURN_PASS: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}


import { defineConfig, presetUno, presetAttributify } from 'unocss'

export default defineConfig({
  presets: [
    presetUno(),
    presetAttributify(),
  ],
  shortcuts: {
    'btn': 'px-4 py-2 rounded-lg cursor-pointer transition-all duration-200 font-medium',
    'btn-primary': 'btn bg-blue-500 text-white hover:bg-blue-600 active:bg-blue-700',
    'btn-danger': 'btn bg-red-500 text-white hover:bg-red-600 active:bg-red-700',
    'btn-secondary': 'btn bg-gray-600 text-white hover:bg-gray-700',
    'card': 'bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6',
    'input-base': 'w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500',
  },
  theme: {
    colors: {
      primary: '#3b82f6',
    }
  }
})


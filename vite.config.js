import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const stage = env.VITE_API_STAGE ? `/${env.VITE_API_STAGE}` : ''

  return {
    plugins: [react()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
      },
    },
    server: {
      proxy: {
        '/scoop/stories.json': {
          target: 'https://airdate.tv',
          changeOrigin: true,
          secure: true,
        },
        '/scoop/stories': {
          target: 'https://airdate.tv',
          changeOrigin: true,
          secure: true,
        },
        '/api': {
          target: 'https://21ave5trw7.execute-api.us-east-1.amazonaws.com',
          changeOrigin: true,
          rewrite: (p) => p.replace(/^\/api/, stage),
          secure: true,
        },
      },
    },
  }
})

import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  // Load env file based on `mode` in the current working directory.
  const env = loadEnv(mode, process.cwd(), '')
  
  return {
    base: './',
    plugins: [react()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
      },
    },
    optimizeDeps: {
      include: ['immer', 'zustand', 'zustand/middleware/immer']
    },
    server: {
      port: parseInt(env.VITE_PORT || '3000'),
      open: true,
      // Disable proxy when using production backend
      // Comment out proxy to use VITE_API_URL from .env
      // proxy: {
      //   '/api': {
      //     target: `http://localhost:${env.VITE_API_PORT || '5000'}`,
      //     changeOrigin: true,
      //     secure: false,
      //   },
      // },
    },
    build: {
      outDir: 'dist',
      sourcemap: true,
      rollupOptions: {
        output: {
          manualChunks: {
            'react-vendor': ['react', 'react-dom', 'react-router-dom'],
            'ui-vendor': ['@radix-ui/react-dialog', '@radix-ui/react-dropdown-menu', '@radix-ui/react-label'],
          },
        },
      },
    },
  }
})
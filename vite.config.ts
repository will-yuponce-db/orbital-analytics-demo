import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  // Load env file based on `mode` in the current working directory.
  const env = loadEnv(mode, process.cwd(), '')
  
  // Map Databricks environment variables to VITE_ prefixed ones for client access
  const databricksEnv = {
    VITE_APP_NAME: env.DATABRICKS_APP_NAME || 'orbital-analytics-demo',
    VITE_APP_URL: env.DATABRICKS_APP_URL || '',
    VITE_PORT: env.PORT || env.DATABRICKS_APP_PORT || '8000',
    VITE_DATABRICKS_HOST: env.DATABRICKS_HOST || '',
    VITE_DATABRICKS_WORKSPACE_ID: env.DATABRICKS_WORKSPACE_ID || '',
    VITE_NODE_ENV: env.NODE_ENV || mode,
  }

  return {
    plugins: [react()],
    // Define environment variables to be available in the app
    define: {
      'import.meta.env.VITE_APP_NAME': JSON.stringify(databricksEnv.VITE_APP_NAME),
      'import.meta.env.VITE_APP_URL': JSON.stringify(databricksEnv.VITE_APP_URL),
      'import.meta.env.VITE_PORT': JSON.stringify(databricksEnv.VITE_PORT),
      'import.meta.env.VITE_DATABRICKS_HOST': JSON.stringify(databricksEnv.VITE_DATABRICKS_HOST),
      'import.meta.env.VITE_DATABRICKS_WORKSPACE_ID': JSON.stringify(databricksEnv.VITE_DATABRICKS_WORKSPACE_ID),
    },
    build: {
      // Production optimizations
      minify: 'esbuild',
      sourcemap: false, // Set to true if you need source maps in production
      rollupOptions: {
        output: {
          manualChunks: {
            // Split vendor chunks for better caching
            'react-vendor': ['react', 'react-dom', 'react-router-dom'],
            'mui-vendor': ['@mui/material', '@mui/icons-material', '@emotion/react', '@emotion/styled'],
            'three-vendor': ['three', '@react-three/fiber', '@react-three/drei'],
          },
        },
      },
      chunkSizeWarningLimit: 1000,
      // Optimize dependencies
      target: 'es2015',
    },
    server: {
      port: parseInt(env.PORT || '3000', 10),
      host: env.UVICORN_HOST || '0.0.0.0',
    },
    preview: {
      port: parseInt(env.PORT || '3000', 10),
      host: env.UVICORN_HOST || '0.0.0.0',
    },
  }
})


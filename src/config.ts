/**
 * Application Configuration
 * 
 * This configuration reads from environment variables that are injected
 * by Databricks Apps during deployment.
 */

interface AppConfig {
  // Environment
  isDevelopment: boolean
  isProduction: boolean
  nodeEnv: string

  // App Identity
  appName: string
  appUrl: string
  port: number

  // Databricks Configuration (if available)
  databricksHost?: string
  databricksWorkspaceId?: string

  // Feature Flags
  enableAnalytics: boolean
  enableDebug: boolean
}

// Read from Vite environment variables (prefixed with VITE_)
// In production, these will be injected during build time
const getConfig = (): AppConfig => {
  const nodeEnv = import.meta.env.MODE || 'development'
  const isProduction = nodeEnv === 'production'
  const isDevelopment = nodeEnv === 'development'

  return {
    // Environment
    isDevelopment,
    isProduction,
    nodeEnv,

    // App Identity
    appName: import.meta.env.VITE_APP_NAME || 'Orbital Analytics Demo',
    appUrl: import.meta.env.VITE_APP_URL || window.location.origin,
    port: parseInt(import.meta.env.VITE_PORT || '8000', 10),

    // Databricks Configuration
    databricksHost: import.meta.env.VITE_DATABRICKS_HOST,
    databricksWorkspaceId: import.meta.env.VITE_DATABRICKS_WORKSPACE_ID,

    // Feature Flags
    enableAnalytics: import.meta.env.VITE_ENABLE_ANALYTICS === 'true' || isProduction,
    enableDebug: import.meta.env.VITE_ENABLE_DEBUG === 'true' || isDevelopment,
  }
}

export const config = getConfig()

// Log configuration in development
if (config.isDevelopment) {
  console.log('App Configuration:', {
    ...config,
    databricksHost: config.databricksHost ? '***' : undefined,
    databricksWorkspaceId: config.databricksWorkspaceId ? '***' : undefined,
  })
}

export default config


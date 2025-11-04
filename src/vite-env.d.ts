/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly MODE: string
  readonly VITE_APP_NAME: string
  readonly VITE_APP_URL: string
  readonly VITE_APP_VERSION?: string
  readonly VITE_PORT: string
  readonly VITE_DATABRICKS_HOST?: string
  readonly VITE_DATABRICKS_WORKSPACE_ID?: string
  readonly VITE_ENABLE_ANALYTICS?: string
  readonly VITE_ENABLE_DEBUG?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}


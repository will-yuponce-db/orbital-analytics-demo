import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { ThemeProvider } from '@mui/material/styles'
import CssBaseline from '@mui/material/CssBaseline'
import App from './App'
import theme from './theme'
import { config } from './config'

// Initialize app configuration
if (config.isProduction) {
  console.log(`%c${config.appName}`, 'font-size: 16px; font-weight: bold; color: #1976d2;')
  console.log(`%cEnvironment: Production`, 'color: #2e7d32;')
  console.log(`%cVersion: ${import.meta.env.VITE_APP_VERSION || '1.0.0'}`, 'color: #666;')
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      <ThemeProvider theme={theme}>
        <CssBaseline />
        <App />
      </ThemeProvider>
    </BrowserRouter>
  </React.StrictMode>
)

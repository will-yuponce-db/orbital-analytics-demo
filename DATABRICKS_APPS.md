# Databricks Apps Deployment Guide

This application is optimized for deployment on **Databricks Apps** and automatically uses the environment variables provided by the platform.

## Environment Variables

The application automatically detects and uses the following Databricks Apps environment variables:

### Runtime Environment
- `NODE_ENV=production` - Application runs in production mode
- `PORT=8000` - Server port (mapped to `VITE_PORT` for client access)

### Databricks Configuration
- `DATABRICKS_APP_NAME` - Application name (e.g., "orbital-analytics-demo")
- `DATABRICKS_APP_URL` - Full application URL (e.g., "https://orbital-analytics-demo-*.databricksapps.com")
- `DATABRICKS_HOST` - Databricks workspace host
- `DATABRICKS_WORKSPACE_ID` - Workspace identifier
- `DATABRICKS_CLIENT_ID` - OAuth client ID (server-side only)
- `DATABRICKS_CLIENT_SECRET` - OAuth client secret (server-side only, never exposed to client)

### Server Configuration
- `UVICORN_HOST=0.0.0.0` - Server bind address
- `UVICORN_PORT=8000` - Uvicorn server port
- `FLASK_RUN_HOST=0.0.0.0` - Flask server host
- `FLASK_RUN_PORT=8000` - Flask server port
- `GRADIO_SERVER_NAME=0.0.0.0` - Gradio server name
- `GRADIO_SERVER_PORT=8000` - Gradio server port
- `STREAMLIT_SERVER_ADDRESS=0.0.0.0` - Streamlit server address
- `STREAMLIT_SERVER_PORT=8000` - Streamlit server port

## How Environment Variables Work

### Build Time
The `vite.config.ts` automatically maps Databricks environment variables to client-accessible `VITE_` prefixed variables during the build process:

```typescript
// Databricks environment variables are mapped:
DATABRICKS_APP_NAME → VITE_APP_NAME
DATABRICKS_APP_URL → VITE_APP_URL
PORT → VITE_PORT
DATABRICKS_HOST → VITE_DATABRICKS_HOST
DATABRICKS_WORKSPACE_ID → VITE_DATABRICKS_WORKSPACE_ID
```

### Runtime
The application reads these variables through the centralized config system (`src/config.ts`):

```typescript
import { config } from './config'

// Access configuration
console.log(config.appName)      // "orbital-analytics-demo"
console.log(config.appUrl)       // Full Databricks Apps URL
console.log(config.isProduction) // true in production
```

## Configuration System

The app uses a centralized configuration module at `src/config.ts` that provides:

- **Environment detection**: `isDevelopment`, `isProduction`
- **App identity**: `appName`, `appUrl`, `port`
- **Databricks info**: `databricksHost`, `databricksWorkspaceId`
- **Feature flags**: `enableAnalytics`, `enableDebug`

## Local Development

For local development, create a `.env.local` file:

```env
VITE_APP_NAME=orbital-analytics-demo
VITE_APP_URL=http://localhost:3000
VITE_PORT=3000
VITE_ENABLE_DEBUG=true
```

## Deployment

The app automatically uses Databricks Apps environment variables when deployed. No additional configuration needed!

### Build Command
```bash
npm run build
```

### Start Command (as configured in app.yml)
```bash
npm run start
```

## Production Optimizations

When `NODE_ENV=production`, the application:

1. ✅ Enables production React mode
2. ✅ Minifies and optimizes JavaScript
3. ✅ Splits vendor chunks for better caching
4. ✅ Disables debug logging
5. ✅ Enables analytics (if configured)
6. ✅ Uses production API endpoints

## Security Notes

- ⚠️ Never expose `DATABRICKS_CLIENT_SECRET` to client-side code
- ✅ Only environment variables prefixed with `VITE_` are accessible in the browser
- ✅ Sensitive credentials remain server-side only
- ✅ The config system automatically filters sensitive data from logs

## Monitoring

In production mode, the application logs:
- Application name and version
- Environment mode (Production)
- Configuration loaded (with sensitive data masked)

Check the browser console for initialization messages.

## Available Packages

The Databricks Apps runtime includes all necessary packages:
- **Frontend**: React, Material-UI, Three.js, React Three Fiber
- **Build Tools**: Vite, TypeScript, esbuild
- **Backend** (if needed): FastAPI, Uvicorn, Flask, Streamlit, Gradio

See the full package list in the Databricks Apps environment configuration.

## Troubleshooting

### Issue: Environment variables not available
**Solution**: Ensure variables are defined in `app.yml` or are part of the Databricks Apps default environment.

### Issue: Build fails with missing dependencies
**Solution**: All build dependencies are now in `dependencies` instead of `devDependencies` to ensure availability during production builds.

### Issue: TypeScript errors during build
**Solution**: Run `npm run lint` locally to catch issues before deployment.

## Support

For Databricks Apps specific issues, refer to:
- [Databricks Apps Documentation](https://docs.databricks.com/apps/)
- [Databricks Apps API Reference](https://docs.databricks.com/api/workspace/apps)


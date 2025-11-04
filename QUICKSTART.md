# 🚀 Quick Start Guide

## Production Server

Run the production-optimized application:

```bash
npm start
```

This command will:
1. ✅ Type-check your TypeScript code
2. ✅ Build the optimized production bundle
3. ✅ Start the production server on **http://localhost:3000**

## Development Server

For development with hot module reloading:

```bash
npm run dev
```

Runs on **http://localhost:3000**

## Available Commands

| Command | Description |
|---------|-------------|
| `npm start` | **Production server** (build + serve) |
| `npm run dev` | Development server with HMR |
| `npm run build` | Build production bundle |
| `npm run preview` | Preview production build |
| `npm run lint` | Run ESLint |
| `npm run lint:fix` | Fix ESLint errors |

## What's Optimized

Your production build includes:

### 📦 Code Splitting
- `react-vendor.js` (163 KB) - React libraries
- `mui-vendor.js` (371 KB) - Material-UI components
- `three-vendor.js` (852 KB) - 3D visualization
- `index.js` (417 KB) - Your application code

**Total**: ~1.8 MB (gzipped: ~521 KB)

### ⚡ Performance Features
- esbuild minification
- Tree shaking (removes unused code)
- Asset fingerprinting for cache busting
- Gzip-ready compression
- ES2015+ modern JavaScript

## Deployment

See [PRODUCTION.md](PRODUCTION.md) for complete deployment instructions including:
- Docker deployment
- Static hosting (Netlify, Vercel)
- Traditional servers (Nginx, Apache)
- Cloud platforms (AWS, Azure, GCP)

## Quick Deploy

### Docker
```bash
docker-compose up -d
# Access at http://localhost
```

### Netlify
```bash
netlify deploy --prod
```

### Vercel
```bash
vercel --prod
```

## Need Help?

- 📖 [README.md](README.md) - Full documentation
- 🏭 [PRODUCTION.md](PRODUCTION.md) - Deployment guide
- 📋 [DEPLOYMENT_SUMMARY.md](DEPLOYMENT_SUMMARY.md) - Implementation details

---

**Ready to launch!** 🛰️ Just run `npm start` and open http://localhost:3000


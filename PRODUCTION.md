# Production Deployment Guide

## Quick Start

Run the production server:
```bash
npm start
```

This will:
1. Run TypeScript compilation and type checking
2. Build optimized production bundle
3. Serve the application on http://localhost:3000

## Environment Variables

Create environment-specific configuration files:

### `.env.production` (for production builds)
```env
VITE_APP_ENV=production
VITE_APP_NAME=Satellite Demo
VITE_APP_VERSION=1.0.0

# API Configuration (update with your values)
VITE_API_URL=https://your-production-api.com
VITE_API_KEY=your-production-api-key

# Feature Flags
VITE_ENABLE_ANALYTICS=true
VITE_ENABLE_DEBUG=false
```

### `.env.local` (for local development)
```env
VITE_APP_ENV=development
VITE_ENABLE_DEBUG=true
```

**Note**: All environment variables must be prefixed with `VITE_` to be exposed to the application.

## Build Optimizations

The production build includes the following optimizations:

### Code Splitting
Vendor libraries are split into separate chunks for better caching:
- `react-vendor.js` - React, React DOM, React Router
- `mui-vendor.js` - Material-UI components and styling
- `three-vendor.js` - Three.js and React Three Fiber

This ensures that when you update your application code, users don't need to re-download the entire vendor bundle.

### Minification
- JavaScript is minified using esbuild (faster than Terser)
- CSS is minified and optimized
- HTML is minified

### Asset Optimization
- Images are optimized for web delivery
- Static assets are fingerprinted for cache busting
- Source maps are disabled for smaller bundle size

### Performance Targets
- Initial bundle size: < 200KB (gzipped)
- Vendor chunks: Cached separately
- Chunk size warning threshold: 1MB

## Deployment Options

### Static Hosting (Recommended)

Deploy the `dist/` folder to any static hosting service:

#### Netlify
```bash
npm run build
# Deploy dist/ folder via Netlify CLI or drag-and-drop
```

Configuration file (`netlify.toml`):
```toml
[build]
  command = "npm run build"
  publish = "dist"

[[redirects]]
  from = "/*"
  to = "/index.html"
  status = 200
```

#### Vercel
```bash
npm run build
# Deploy via Vercel CLI
vercel --prod
```

#### AWS S3 + CloudFront
```bash
npm run build
aws s3 sync dist/ s3://your-bucket-name --delete
aws cloudfront create-invalidation --distribution-id YOUR_DIST_ID --paths "/*"
```

### Traditional Server

#### Nginx
```nginx
server {
    listen 80;
    server_name your-domain.com;
    
    root /var/www/satellite-demo/dist;
    index index.html;
    
    # Enable gzip compression
    gzip on;
    gzip_types text/plain text/css application/json application/javascript text/xml application/xml application/xml+rss text/javascript;
    
    # SPA fallback
    location / {
        try_files $uri $uri/ /index.html;
    }
    
    # Cache static assets
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }
}
```

#### Apache (.htaccess)
```apache
<IfModule mod_rewrite.c>
  RewriteEngine On
  RewriteBase /
  RewriteRule ^index\.html$ - [L]
  RewriteCond %{REQUEST_FILENAME} !-f
  RewriteCond %{REQUEST_FILENAME} !-d
  RewriteRule . /index.html [L]
</IfModule>

# Enable compression
<IfModule mod_deflate.c>
  AddOutputFilterByType DEFLATE text/html text/plain text/xml text/css application/javascript application/json
</IfModule>

# Cache static assets
<IfModule mod_expires.c>
  ExpiresActive On
  ExpiresByType image/jpg "access plus 1 year"
  ExpiresByType image/jpeg "access plus 1 year"
  ExpiresByType image/gif "access plus 1 year"
  ExpiresByType image/png "access plus 1 year"
  ExpiresByType text/css "access plus 1 month"
  ExpiresByType application/javascript "access plus 1 month"
</IfModule>
```

### Docker

Create a `Dockerfile`:
```dockerfile
# Build stage
FROM node:18-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

# Production stage
FROM nginx:alpine
COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
```

Build and run:
```bash
docker build -t satellite-demo .
docker run -p 80:80 satellite-demo
```

## Performance Monitoring

### Build Analysis
Analyze bundle size:
```bash
npm run build -- --mode=analyze
```

### Lighthouse Audit
Run performance audit:
```bash
npm install -g lighthouse
lighthouse http://localhost:3000 --view
```

Target scores:
- Performance: > 90
- Accessibility: > 95
- Best Practices: > 90
- SEO: > 90

## Security Considerations

### Content Security Policy (CSP)
Add to your hosting service or server configuration:
```
Content-Security-Policy: default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self' data:;
```

### HTTPS
Always serve production applications over HTTPS:
- Use Let's Encrypt for free SSL certificates
- Configure HSTS headers
- Redirect HTTP to HTTPS

### Environment Variables
- Never commit `.env` files to version control
- Use `.env.example` as a template
- Store sensitive values in your hosting provider's environment variable system

## Monitoring & Logging

### Application Monitoring
Consider integrating:
- Sentry for error tracking
- Google Analytics or Plausible for usage analytics
- LogRocket for session replay

### Server Monitoring
- Uptime monitoring (UptimeRobot, Pingdom)
- Performance monitoring (New Relic, DataDog)
- Log aggregation (ELK Stack, Splunk)

## Rollback Strategy

### Version Control
- Tag releases: `git tag -a v1.0.0 -m "Release 1.0.0"`
- Keep previous builds accessible
- Document changes in CHANGELOG.md

### Quick Rollback
```bash
# Revert to previous commit
git revert HEAD
npm run build
# Redeploy

# Or checkout previous tag
git checkout v1.0.0
npm run build
# Redeploy
```

## Troubleshooting

### Build Fails
```bash
# Clear cache and reinstall
rm -rf node_modules dist
npm install
npm run build
```

### Port Already in Use
```bash
# Change port in vite.config.ts
preview: {
  port: 3001, // Use different port
  host: true,
}
```

### Memory Issues During Build
```bash
# Increase Node memory limit
NODE_OPTIONS="--max-old-space-size=4096" npm run build
```

## Post-Deployment Checklist

- [ ] Run `npm start` and verify application works locally
- [ ] Check browser console for errors
- [ ] Test on multiple browsers (Chrome, Firefox, Safari, Edge)
- [ ] Test on mobile devices
- [ ] Verify all environment variables are set correctly
- [ ] Run Lighthouse audit
- [ ] Test all critical user flows
- [ ] Verify analytics are tracking correctly
- [ ] Check that static assets load properly
- [ ] Verify HTTPS is working
- [ ] Test error handling and 404 pages
- [ ] Monitor application logs for errors

## Support

For issues or questions:
1. Check the main [README.md](README.md) for general information
2. Review [package.json](package.json) for available scripts
3. Check [vite.config.ts](vite.config.ts) for build configuration


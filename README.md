# 🛡️ USSF Space Domain Awareness Platform

<div align="center">

**Training & Testing Infrastructure for Space Operations Centers**

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)
[![React](https://img.shields.io/badge/React-18-61DAFB?logo=react)](https://reactjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0-3178C6?logo=typescript)](https://www.typescriptlang.org/)
[![Three.js](https://img.shields.io/badge/Three.js-3D-000000?logo=three.js)](https://threejs.org/)

[Demo](#-quick-start) • [Features](#-complete-feature-set) • [Documentation](#-system-architecture) • [Contributing](#️-license--security-notice)

</div>

---

## 📖 Overview

Advanced training platform for Space Operations Center (SPOC) operators, providing realistic orbital analysis, threat assessment scenarios, and AI-powered decision support for operational training and certification. Built for USSF Space Domain Awareness operations with DoD-compliant security features.

### Key Capabilities

- 🛰️ **Real-time Orbital Tracking** - 3D visualization with Three.js, tracking 12,000+ objects
- 🤖 **AI Decision Support** - Digital twin recommendations with confidence scoring
- ⚔️ **Threat Assessment** - Hostile satellite monitoring and ASAT detection
- 🚨 **C2 Alert Management** - FLASH priority alerts with automated dissemination
- 🔐 **DoD Security** - Classification banners, RBAC, and NIST 800-53 audit logging

---

## 🎬 Quick Start

Get the platform running in under 2 minutes:

### Prerequisites

- Node.js 18+ and npm
- Modern web browser (Chrome, Firefox, Edge)

### Installation

```bash
# Clone the repository
git clone <repository-url>
cd satellite-demo

# Install dependencies
npm install

# Start development server
npm run dev
```

### First Steps

1. **Open** `http://localhost:5173` in your browser
2. **Enter the Scenario Library** from the home page
3. **Select a scenario** by threat type or data quality
4. **Analyze** using: 3D visualization, AI recommendations, threat panels
5. **Practice** decision-making with the What-If maneuver planner

---

## 📚 **Scenario Library** 

**Direct access to all training scenarios - no prerequisites, no unlocking**

- ✅ Instant access to 6 operational scenarios
- ✅ Filter by threat type, data quality, tags
- ✅ Search and recently viewed tracking
- ✅ Perfect for testing and certification

**Primary Use Cases:**
- SPOC operator certification testing
- System infrastructure validation
- Threat response training
- Quick scenario analysis and familiarization

### Key Features at a Glance

| Feature | What It Does | Where to Find It |
|---------|-------------|------------------|
| 🛰️ **3D Visualization** | Interactive orbital view with real-time propagation | Center panel |
| 🤖 **AI Recommendations** | Automated decision support with confidence scores | AI Twin tab |
| ⚔️ **Threat Assessment** | Hostile satellite tracking & behavior profiling | Threats tab |
| 🚨 **C2 Alerts** | FLASH priority alerts with dissemination workflow | C2 Alerts tab |
| 🔧 **What-If Planner** | Model maneuvers with delta-V & fuel cost analysis | What-If tab |
| 📊 **SSN Data Feed** | Real-time sensor network status (9 sensors) | SSN Feed tab |

### Keyboard Shortcuts

- `T` - Jump to Threats panel
- `A` - Jump to AI Twin panel
- `W` - Jump to What-If planner
- `Esc` - Close mobile drawers
- `Ctrl/Cmd + K` - Search scenarios (dashboard)

---

## 🏗️ System Architecture

```
┌─────────────────────────────────────────────────────────────┐
│  USSF Space Domain Awareness Platform                       │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐     │
│  │ Classification│  │   User RBAC  │  │ Audit Logging│     │
│  │    Banners   │  │  (SECRET+SCI)│  │ (NIST 800-53)│     │
│  └──────────────┘  └──────────────┘  └──────────────┘     │
└─────────────────────────────────────────────────────────────┘
                           ▼
┌─────────────────────────────────────────────────────────────┐
│  Data Ingestion Layer                                        │
│  ┌────────────┐ ┌────────────┐ ┌────────────┐             │
│  │ SSN Feeds  │ │ EW Sensors │ │ NRO/Intel  │             │
│  │ (JSpOC)    │ │ (SIGINT)   │ │ (Threats)  │             │
│  └────────────┘ └────────────┘ └────────────┘             │
└─────────────────────────────────────────────────────────────┘
                           ▼
┌─────────────────────────────────────────────────────────────┐
│  AI/ML Analytics Engine                                      │
│  ┌────────────┐ ┌────────────┐ ┌────────────┐             │
│  │ Threat ID  │ │ Collision  │ │ Maneuver   │             │
│  │ (Digital   │ │ Prediction │ │ Planning   │             │
│  │  Twin)     │ │ (CDM Gen.) │ │ (Delta-V)  │             │
│  └────────────┘ └────────────┘ └────────────┘             │
└─────────────────────────────────────────────────────────────┘
                           ▼
┌─────────────────────────────────────────────────────────────┐
│  Operator Interface (React/TypeScript)                       │
│  - 3D Orbital Visualization (Three.js)                       │
│  - Real-time Telemetry Dashboard                            │
│  - C2 Alert Management                                       │
│  - Threat Assessment Panel                                   │
└─────────────────────────────────────────────────────────────┘
```

---

## 🎯 Complete Feature Set

### 🛰️ **Space Surveillance Network (SSN) Integration**
- **Real-time sensor feeds** from Space Fence, PAVE PAWS, and GEODSS sites
- **9 active sensors** tracking 12,000+ objects
- **JSpOC/18 SPCS integration** with encrypted data links
- Live telemetry from radar, optical, and space-based sensors

### ⚔️ **Threat Assessment & Counter-Space Operations**
- **Hostile satellite tracking** with behavior profiling (COSMOS 2558, SHIYAN-21)
- **ASAT weapon detection** and kinetic threat analysis
- **Co-orbital threat monitoring** for proximity operations
- **Maneuver history analysis** to differentiate hostile vs. routine maneuvers
- Real-time threat level assessment (None/Low/Moderate/High/Critical)

### 📡 **Electronic Warfare (EW) Threat Detection**
- **Active jamming detection** on military SATCOM (WGS, DSCS)
- **GPS spoofing alerts** with geolocation of ground-based EW sites
- **RF interference monitoring** across X-band, Ku-band, L-band
- Source attribution to foreign EW facilities

### 🚨 **Command & Control (C2) Alert System**
- **FLASH/IMMEDIATE priority alerts** for critical threats
- **Automated dissemination** to USSPACECOM, NRO, JCS, NSC
- **Multi-level acknowledgment** workflow for commanders
- **Conjunction warnings** with Time of Closest Approach (TCA)
- Integration with operational units (614 AOC, 2 SOPS, 18 SPCS)

### 🤖 **AI Digital Twin Decision Support**
- **Collision avoidance recommendations** with confidence scores
- **Predictive analytics** for orbital decay and maneuver requirements
- **Automated anomaly detection** on satellite telemetry
- **What-if scenario modeling** for maneuver planning

### 🔐 **DoD Classification & Security**
- **UNCLASSIFIED/CONFIDENTIAL/SECRET/TOP SECRET** classification banners
- **SCI compartment controls** (TK, SI, GAMMA, HCS)
- **Role-Based Access Control (RBAC)** - Operator/Analyst/Commander/Engineer
- **Need-to-know enforcement** with clearance verification
- **NOFORN/RELIDO caveats** per DoD 5220.22-M
- **Audit logging** for NIST SP 800-53 compliance

### 🛠️ **Orbital Maneuver Planning**
- **Delta-V calculations** for collision avoidance, orbit raising/lowering
- **Fuel cost analysis** with Hohmann transfer algorithms
- **Collision probability assessment** with proximity analysis
- **Scenario variants** to test maneuver outcomes
- Integration with satellite propulsion systems

### 📊 **Real-Time Analytics**
- **Altitude, velocity, inclination trends** over 24-hour periods
- **Conjunction risk scoring** with miss distance predictions
- **Orbital decay modeling** from atmospheric drag
- **Solar activity correlation** with satellite performance

---

## 🔥 Why Space Force Needs This (10/10 Relevance)

### **Current Capability Gaps This Solves:**

✅ **Unified Threat Picture** - Consolidates SSN tracking + EW + Intel into single pane of glass  
✅ **Hostile Maneuver Detection** - AI identifies threatening behavior patterns automatically  
✅ **Rapid Decision Support** - Commanders get actionable recommendations in seconds, not hours  
✅ **Coalition Interoperability** - Role-based access enables info sharing with allies (RELIDO)  
✅ **Audit Compliance** - Built-in logging meets DoD cybersecurity requirements  

### **Aligns With:**
- Space Policy Directive-3 (Space Traffic Management)
- USSPACECOM Operations Plan 2025
- DoD Space Strategy (Resilience & Protection)
- NIST Cybersecurity Framework
- 18 SPCS Mission Requirements

### **Operational Use Cases:**
1. **Counter-Space Operations** - Track Russian/Chinese ASAT tests and co-orbital threats
2. **Electronic Warfare Defense** - Detect and geolocate jamming of GPS/SATCOM
3. **Collision Avoidance** - Automate CDM generation and maneuver planning
4. **Training & Exercises** - Realistic scenarios for Space Operator training
5. **Allied Coordination** - Share sanitized SDA data with Five Eyes partners

---

## 📦 Technology Stack

| Category | Technologies |
|----------|-------------|
| **Frontend** | React 18 + TypeScript + Vite |
| **UI Framework** | Material-UI (MUI) with dark space theme |
| **3D Graphics** | Three.js (ready for Cesium integration) |
| **Routing** | React Router v6 |
| **Orbital Mechanics** | SGP4 propagator with Keplerian elements |
| **State Management** | React hooks (scalable to Redux) |
| **Security** | DoD 5220.22-M compliant classification |
| **Audit Logging** | NIST SP 800-53 (AU Family) |
| **Build Tool** | Vite (fast HMR, optimized builds) |

---

## 📁 Project Structure

```
Satelite demo/
├── src/
│   ├── components/         # React components
│   │   ├── 3d/            # Three.js 3D visualization components
│   │   ├── AITwinPanel.tsx
│   │   ├── ThreatAssessmentPanel.tsx
│   │   └── ...
│   ├── pages/             # Route-level page components
│   ├── data/              # Scenario data and mock feeds
│   ├── types/             # TypeScript type definitions
│   ├── utils/             # Utility functions (orbital calc, audit)
│   ├── theme.ts           # MUI theme configuration
│   └── main.tsx           # Application entry point
├── public/                # Static assets
├── package.json           # Dependencies and scripts
├── tsconfig.json          # TypeScript configuration
├── vite.config.ts         # Vite build configuration
└── README.md             # This file
```

---

## 🚀 Deployment

### Development Mode
```bash
npm run dev  # Runs on localhost:3000 with hot module reloading
```

### Production Server ⭐
```bash
npm start  # Builds and serves optimized production bundle on localhost:3000
```

This command automatically:
- ✅ Compiles TypeScript with strict type checking
- ✅ Minifies and optimizes all assets with esbuild
- ✅ Splits vendor chunks for optimal caching (React, MUI, Three.js)
- ✅ Removes development code and source maps
- ✅ Serves production build on port 3000

### Manual Production Build
```bash
npm run build   # Creates optimized build in ./dist
npm run preview # Serves the built files
```

### Production Optimizations Included
- **Code Splitting**: Separate chunks for React, MUI, and Three.js vendors
- **Tree Shaking**: Automatically removes unused code
- **Minification**: esbuild-powered compression
- **Asset Optimization**: Optimized images and static files
- **ES2015+ Target**: Modern browser optimizations
- **Chunk Size Management**: 1MB warning threshold for performance monitoring

### Static Deployment Options
The `dist/` folder contains static files ready to deploy to:
- **CDN/Static Hosting**: Netlify, Vercel, GitHub Pages
- **Cloud Storage**: AWS S3 + CloudFront, Azure Blob Storage
- **Traditional Servers**: nginx, Apache, IIS

### DoD IL4/IL5 Deployment (Future)
- Deploy to AWS GovCloud or Azure Government
- Integrate with SIPRNET for classified data
- CAC authentication via DoD PKI
- STIG-hardened containers
- Redis for session management
- PostgreSQL for audit logs
- Nginx reverse proxy with SSL/TLS 1.3

---

## 🧪 Available Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start development server with hot reload |
| `npm run build` | Build for production |
| `npm run preview` | Preview production build locally |
| `npm run lint` | Run ESLint to check code quality |

---

## 📋 Scenarios Included

1. **LEO Constellation Analysis** - Multi-satellite conjunction assessment with debris field
2. **ISS Reboost Training** - Station-keeping maneuver planning and prediction
3. **Debris Field Collision Risk** - Testing collision prediction algorithms
4. **Starlink Constellation Monitor** - Commercial satellite anomaly detection
5. **GEO Belt Analysis** - Geostationary orbit dynamics and stationkeeping
6. **Re-entry Prediction Test** - Atmospheric decay modeling for rocket bodies

Each scenario includes realistic SSN data feeds, threat objects, EW signatures, and C2 alerts for comprehensive training.

---

## 🎓 Training Value

Perfect for:
- **Space Operations Officers** (13S AFSC)
- **Intelligence Analysts** learning counter-space threats
- **Wargaming** at Schriever Space Force Base
- **Coalition Partner** familiarization
- **USSPACECOM** staff exercises

---

## 🔮 Roadmap

### Version 2.0 (Q1 2026)
- [ ] Cesium integration for photorealistic 3D Earth rendering
- [ ] Live TLE feeds from Space-Track.org API
- [ ] Enhanced machine learning threat classification

### Version 3.0 (Q2 2026)
- [ ] Multi-user collaboration via WebSocket
- [ ] Mobile app for on-call duty officers
- [ ] Real-time notification system

### Future Considerations
- [ ] Integration with AEHF/WGS actual telemetry
- [ ] Augmented reality heads-up display for operations floor
- [ ] Advanced trajectory optimization algorithms

---

## 🤝 Contributing

Contributions are welcome! This is a demonstration platform for educational and training purposes.

### How to Contribute

1. **Fork** the repository
2. **Create** a feature branch (`git checkout -b feature/AmazingFeature`)
3. **Commit** your changes (`git commit -m 'Add some AmazingFeature'`)
4. **Push** to the branch (`git push origin feature/AmazingFeature`)
5. **Open** a Pull Request

### Development Guidelines

- Follow TypeScript best practices
- Maintain existing code style (ESLint configuration)
- Add comments for complex orbital mechanics calculations
- Update documentation for new features
- Test across different browsers

---

## 🐛 Known Issues

- Three.js performance may degrade with >1000 simultaneous objects
- Mobile viewport optimization in progress
- Safari WebGL compatibility requires testing

Report issues on the [GitHub Issues](../../issues) page.

---

## 📞 Support & Contact

### For Space Force Integration Inquiries
- USSF/S3D Space Operations
- USSPACECOM/J3  
- 18th Space Defense Squadron

### Technical Support
This is a demonstration platform showcasing next-generation SDA capabilities. Not affiliated with DoD.

For technical questions or feature requests, please open an issue on GitHub.

---

## ⚖️ License

This project is licensed under the **MIT License** - see below for details:

```
MIT License

Copyright (c) 2025 USSF Space Domain Awareness Platform

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT.
```

---

## 🔒 Security Notice

**⚠️ IMPORTANT:** This is a demonstration platform for educational and training purposes only.

- ✅ All data is **UNCLASSIFIED** and simulated
- ✅ Threat scenarios derived from open-source intelligence
- ✅ No actual classified information is contained in this system
- ✅ Satellite designators (USA-XXX) and foreign capabilities are fictional or public
- ✅ Not affiliated with or endorsed by the U.S. Department of Defense

### For Official DoD Use
Contact appropriate acquisition channels:
- Space Systems Command (SSC)
- AFMC Space Acquisition
- SAF/SQ (Space Acquisition Office)

---

## 🙏 Acknowledgments

This project leverages several outstanding open-source technologies:

- **[React](https://reactjs.org/)** - UI framework
- **[Three.js](https://threejs.org/)** - 3D graphics library
- **[Material-UI](https://mui.com/)** - Component library
- **[Vite](https://vitejs.dev/)** - Build tool and dev server
- **[TypeScript](https://www.typescriptlang.org/)** - Type safety

### Inspiration
- USSPACECOM Space Domain Awareness operations
- 18th Space Defense Squadron mission requirements
- Space Policy Directive-3 (Space Traffic Management)

---

## 📊 Project Status

![Status](https://img.shields.io/badge/Status-Active%20Development-green)
![Version](https://img.shields.io/badge/Version-1.0.0-blue)

**Last Updated:** November 2025

---

<div align="center">

## 🛡️ **SEMPER SUPRA - Always Above**

*Demonstrating the future of Space Domain Awareness operations*

---

**⭐ Star this repository if you find it useful!**

[Report Bug](../../issues) • [Request Feature](../../issues) • [Documentation](#-overview)

</div>

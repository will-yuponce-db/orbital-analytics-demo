import React from 'react'
import { Box } from '@mui/material'

/** Closed elliptical path centered on the origin (animateMotion needs a <path>). */
const ellipse = (rx: number, ry: number) =>
  `M ${-rx} 0 A ${rx} ${ry} 0 1 0 ${rx} 0 A ${rx} ${ry} 0 1 0 ${-rx} 0 Z`

/**
 * Decorative orbit motif for the Home hero: the limb of the Earth, three orbit
 * tracks and two slow-moving objects. Hidden from assistive tech; motion stops
 * under prefers-reduced-motion.
 */
const OrbitBackdrop: React.FC = () => (
  <Box
    aria-hidden
    sx={{
      position: 'absolute',
      inset: 0,
      pointerEvents: 'none',
      overflow: 'hidden',
      '@media (prefers-reduced-motion: reduce)': { '& .ow-moving': { display: 'none' } },
    }}
  >
    <svg width="100%" height="100%" viewBox="0 0 1200 520" preserveAspectRatio="xMaxYMid slice">
      <defs>
        <radialGradient id="owEarth" cx="30%" cy="30%" r="80%">
          <stop offset="0%" stopColor="#2d6cb5" stopOpacity="0.55" />
          <stop offset="70%" stopColor="#123a6b" stopOpacity="0.35" />
          <stop offset="100%" stopColor="#0a1f3d" stopOpacity="0.1" />
        </radialGradient>
        <radialGradient id="owGlow" cx="50%" cy="50%" r="50%">
          <stop offset="70%" stopColor="#64b5f6" stopOpacity="0" />
          <stop offset="100%" stopColor="#64b5f6" stopOpacity="0.18" />
        </radialGradient>
      </defs>
      <g transform="translate(1040 560)">
        <circle r="330" fill="url(#owGlow)" />
        <circle r="300" fill="url(#owEarth)" />
        <path
          d={ellipse(540, 380)}
          transform="rotate(-4)"
          fill="none"
          stroke="#90a4ae"
          strokeOpacity="0.14"
          strokeWidth="1.2"
        />
        <g transform="rotate(-18)">
          <path
            id="owOrbitA"
            d={ellipse(470, 210)}
            fill="none"
            stroke="#64b5f6"
            strokeOpacity="0.28"
            strokeWidth="1.2"
          />
          <circle className="ow-moving" r="4" fill="#90caf9">
            <animateMotion dur="70s" repeatCount="indefinite">
              <mpath href="#owOrbitA" />
            </animateMotion>
          </circle>
        </g>
        <g transform="rotate(24)">
          <path
            id="owOrbitB"
            d={ellipse(430, 300)}
            fill="none"
            stroke="#ffa726"
            strokeOpacity="0.22"
            strokeWidth="1.2"
            strokeDasharray="5 7"
          />
          <circle className="ow-moving" r="3.5" fill="#ffb74d">
            <animateMotion dur="95s" begin="-30s" repeatCount="indefinite">
              <mpath href="#owOrbitB" />
            </animateMotion>
          </circle>
        </g>
      </g>
    </svg>
  </Box>
)

export default OrbitBackdrop

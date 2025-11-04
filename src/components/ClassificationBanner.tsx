import React from 'react'
import { Box, Typography } from '@mui/material'
import { ClassificationMarking } from '../types'

interface ClassificationBannerProps {
  classification: ClassificationMarking
  position: 'top' | 'bottom'
}

const ClassificationBanner: React.FC<ClassificationBannerProps> = ({
  classification,
  position,
}) => {
  const getBackgroundColor = (level: string): string => {
    switch (level) {
      case 'TOP SECRET':
        return '#FF8C00' // Orange
      case 'SECRET':
        return '#C8102E' // Red
      case 'CONFIDENTIAL':
        return '#0033A0' // Blue
      case 'UNCLASSIFIED':
      default:
        return '#007A33' // Green
    }
  }

  const formatMarkingText = (): string => {
    let text = classification.level

    // Add caveats
    if (classification.caveats && classification.caveats.length > 0) {
      text += `//${classification.caveats.join('//')}`
    }

    // Add SCI controls
    if (classification.sciControls && classification.sciControls.length > 0) {
      text += `//${classification.sciControls.join('/')}`
    }

    return text
  }

  return (
    <Box
      sx={{
        width: '100%',
        backgroundColor: getBackgroundColor(classification.level),
        color: 'white',
        textAlign: 'center',
        py: 0.5,
        px: 2,
        zIndex: 9999,
        position: 'fixed',
        ...(position === 'top' ? { top: 0 } : { bottom: 0 }),
        left: 0,
        right: 0,
        boxShadow: position === 'top' ? '0 2px 4px rgba(0,0,0,0.2)' : '0 -2px 4px rgba(0,0,0,0.2)',
      }}
    >
      <Typography
        variant="body2"
        sx={{
          fontWeight: 700,
          letterSpacing: 1,
          fontSize: '0.85rem',
          fontFamily: 'monospace',
        }}
      >
        {formatMarkingText()}
      </Typography>
    </Box>
  )
}

export default ClassificationBanner

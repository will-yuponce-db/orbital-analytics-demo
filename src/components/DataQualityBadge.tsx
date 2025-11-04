import React from 'react'
import { Chip } from '@mui/material'
import { DataQuality } from '../types'
import { useTheme } from '@mui/material/styles'

interface DataQualityBadgeProps {
  quality: DataQuality
  size?: 'small' | 'medium'
}

const DataQualityBadge: React.FC<DataQualityBadgeProps> = ({ quality, size = 'small' }) => {
  const theme = useTheme()

  const getColor = () => {
    switch (quality) {
      case 'testing':
        return theme.palette.testing.main
      case 'training':
        return theme.palette.training.main
      case 'operational':
        return theme.palette.operational.main
      default:
        return theme.palette.grey[500]
    }
  }

  const getLabel = () => {
    return quality.charAt(0).toUpperCase() + quality.slice(1)
  }

  return (
    <Chip
      label={getLabel()}
      size={size}
      sx={{
        backgroundColor: getColor(),
        color: 'white',
        fontWeight: 600,
        textTransform: 'uppercase',
        fontSize: size === 'small' ? '0.7rem' : '0.8rem',
      }}
    />
  )
}

export default DataQualityBadge

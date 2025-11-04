import React from 'react'
import {
  Box,
  Typography,
  List,
  Paper,
  Chip,
  LinearProgress,
  Stack,
  IconButton,
  Tooltip,
} from '@mui/material'
import {
  SmartToy as AIIcon,
  Warning as WarningIcon,
  Error as ErrorIcon,
  CheckCircle as CheckIcon,
  Info as InfoIcon,
  MoreVert as MoreIcon,
} from '@mui/icons-material'
import { AIRecommendation } from '../types'

interface AITwinPanelProps {
  recommendations: AIRecommendation[]
  onSensorHighlight?: (sensors: string[]) => void
}

const AITwinPanel: React.FC<AITwinPanelProps> = ({ recommendations, onSensorHighlight }) => {
  const getPriorityIcon = (priority: AIRecommendation['priority']) => {
    switch (priority) {
      case 'critical':
        return <ErrorIcon sx={{ fontSize: 20, color: 'error.main' }} />
      case 'high':
        return <WarningIcon sx={{ fontSize: 20, color: 'warning.main' }} />
      case 'medium':
        return <InfoIcon sx={{ fontSize: 20, color: 'info.main' }} />
      case 'low':
        return <CheckIcon sx={{ fontSize: 20, color: 'success.main' }} />
    }
  }

  const getPriorityColor = (priority: AIRecommendation['priority']) => {
    switch (priority) {
      case 'critical':
        return 'error'
      case 'high':
        return 'warning'
      case 'medium':
        return 'info'
      case 'low':
        return 'success'
      default:
        return 'default'
    }
  }

  const getTypeLabel = (type: AIRecommendation['type']) => {
    return type
      .split('-')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ')
  }

  return (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <Box sx={{ p: 2, borderBottom: 1, borderColor: 'divider' }}>
        <Stack direction="row" spacing={1} alignItems="center">
          <AIIcon color="primary" />
          <Typography variant="subtitle1" fontWeight={600}>
            AI Digital Twin
          </Typography>
        </Stack>
        <Typography variant="caption" color="text.secondary">
          {recommendations.length} recommendation{recommendations.length !== 1 ? 's' : ''}
        </Typography>
      </Box>

      <Box sx={{ flexGrow: 1, overflow: 'auto', p: 2 }}>
        <List sx={{ p: 0 }}>
          {recommendations.map(rec => (
            <Paper
              key={rec.id}
              elevation={1}
              sx={{
                mb: 2,
                p: 2,
                border: '1px solid',
                borderColor: 'divider',
                '&:last-child': { mb: 0 },
              }}
            >
              <Stack spacing={1.5}>
                {/* Header */}
                <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1 }}>
                  {getPriorityIcon(rec.priority)}
                  <Box sx={{ flexGrow: 1 }}>
                    <Typography variant="body2" fontWeight={600}>
                      {getTypeLabel(rec.type)}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {new Date(rec.timestamp).toLocaleString()}
                    </Typography>
                  </Box>
                  <Chip
                    label={rec.priority}
                    size="small"
                    color={getPriorityColor(rec.priority)}
                    sx={{ textTransform: 'capitalize' }}
                  />
                  <Tooltip title="More options">
                    <IconButton
                      size="small"
                      onClick={() => {
                        // Placeholder for future functionality
                        console.log('More options clicked for recommendation:', rec.id)
                      }}
                    >
                      <MoreIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                </Box>

                {/* Description */}
                <Typography variant="body2" color="text.secondary">
                  {rec.description}
                </Typography>

                {/* Affected Sensors */}
                {rec.affectedSensors && rec.affectedSensors.length > 0 && (
                  <Box>
                    <Typography
                      variant="caption"
                      color="text.secondary"
                      sx={{ mb: 0.5, display: 'block' }}
                    >
                      Affected Sensors
                    </Typography>
                    <Stack direction="row" spacing={0.5} flexWrap="wrap" useFlexGap>
                      {rec.affectedSensors.map(sensor => (
                        <Chip
                          key={sensor}
                          label={sensor}
                          size="small"
                          variant="outlined"
                          sx={{
                            fontSize: '0.7rem',
                            height: 22,
                            cursor: 'pointer',
                            '&:hover': {
                              backgroundColor: 'action.hover',
                            },
                          }}
                          onClick={() => onSensorHighlight?.(rec.affectedSensors || [])}
                        />
                      ))}
                    </Stack>
                  </Box>
                )}

                {/* Confidence */}
                <Box>
                  <Box
                    sx={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      mb: 0.5,
                    }}
                  >
                    <Typography variant="caption" color="text.secondary">
                      Confidence
                    </Typography>
                    <Typography variant="caption" fontWeight={600}>
                      {rec.confidence}%
                    </Typography>
                  </Box>
                  <LinearProgress
                    variant="determinate"
                    value={rec.confidence}
                    sx={{
                      height: 6,
                      borderRadius: 1,
                      backgroundColor: 'action.hover',
                    }}
                  />
                </Box>
              </Stack>
            </Paper>
          ))}
        </List>

        {recommendations.length === 0 && (
          <Box
            sx={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              height: '100%',
              gap: 2,
            }}
          >
            <AIIcon sx={{ fontSize: 60, color: 'text.disabled' }} />
            <Typography variant="body2" color="text.secondary" align="center">
              No AI recommendations available
            </Typography>
          </Box>
        )}
      </Box>
    </Box>
  )
}

export default AITwinPanel

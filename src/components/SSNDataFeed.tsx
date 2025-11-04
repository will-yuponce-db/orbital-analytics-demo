import React from 'react'
import {
  Box,
  Typography,
  Paper,
  Stack,
  Grid,
  LinearProgress,
  Chip,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
} from '@mui/material'
import {
  Radar as RadarIcon,
  Satellite as SatelliteIcon,
  Visibility as OpticalIcon,
  FiberManualRecord as StatusIcon,
  SignalCellularAlt as SignalIcon,
} from '@mui/icons-material'
import { SSNDataSource } from '../types'

interface SSNDataFeedProps {
  sources: SSNDataSource[]
}

const SSNDataFeed: React.FC<SSNDataFeedProps> = ({ sources }) => {
  const [currentTime, setCurrentTime] = React.useState(() => Date.now())

  // Update current time every second for real-time status
  React.useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTime(Date.now())
    }, 1000)
    return () => clearInterval(interval)
  }, [])

  const getSensorIcon = (type: string) => {
    switch (type) {
      case 'radar':
        return <RadarIcon />
      case 'optical':
        return <OpticalIcon />
      case 'space-based':
        return <SatelliteIcon />
      default:
        return <SignalIcon />
    }
  }

  const getStatusColor = (lastContact: string): 'success' | 'warning' | 'error' => {
    const minutesSinceContact = (currentTime - new Date(lastContact).getTime()) / 1000 / 60
    if (minutesSinceContact < 5) return 'success'
    if (minutesSinceContact < 15) return 'warning'
    return 'error'
  }

  const getQualityColor = (quality: number): 'error' | 'warning' | 'success' => {
    if (quality >= 80) return 'success'
    if (quality >= 60) return 'warning'
    return 'error'
  }

  const activeSensors = React.useMemo(() => {
    return sources.filter(s => {
      const minutesSinceContact = (currentTime - new Date(s.lastContact).getTime()) / 1000 / 60
      return minutesSinceContact < 15
    })
  }, [sources, currentTime])

  const totalTracked = sources.reduce((sum, s) => sum + s.trackingObjects, 0)
  const avgQuality = sources.reduce((sum, s) => sum + s.dataQuality, 0) / sources.length

  return (
    <Box sx={{ height: '100%', overflow: 'auto', p: 2 }}>
      <Stack spacing={3}>
        {/* Header */}
        <Box>
          <Stack direction="row" spacing={1} alignItems="center">
            <RadarIcon color="primary" />
            <Typography variant="h6">SSN Data Feeds</Typography>
          </Stack>
          <Typography variant="caption" color="text.secondary">
            Space Surveillance Network - Real-time Sensor Status
          </Typography>
        </Box>

        {/* Network Statistics */}
        <Paper variant="outlined" sx={{ p: 2, bgcolor: 'background.default' }}>
          <Grid container spacing={2}>
            <Grid item xs={4}>
              <Box textAlign="center">
                <Typography variant="h4" color="primary.main" fontWeight="bold">
                  {activeSensors.length}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  Active Sensors
                </Typography>
              </Box>
            </Grid>
            <Grid item xs={4}>
              <Box textAlign="center">
                <Typography variant="h4" color="success.main" fontWeight="bold">
                  {totalTracked.toLocaleString()}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  Objects Tracked
                </Typography>
              </Box>
            </Grid>
            <Grid item xs={4}>
              <Box textAlign="center">
                <Typography variant="h4" color={getQualityColor(avgQuality)} fontWeight="bold">
                  {avgQuality.toFixed(0)}%
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  Avg Quality
                </Typography>
              </Box>
            </Grid>
          </Grid>
        </Paper>

        {/* Sensor Status by Type */}
        <Box>
          <Typography variant="subtitle2" gutterBottom fontWeight="bold">
            Sensor Network Status
          </Typography>
          <Grid container spacing={1} sx={{ mb: 2 }}>
            {['radar', 'optical', 'space-based'].map(type => {
              const count = sources.filter(s => s.sensorType === type).length
              const active = activeSensors.filter(s => s.sensorType === type).length
              return (
                <Grid item xs={4} key={type}>
                  <Paper variant="outlined" sx={{ p: 1.5, textAlign: 'center' }}>
                    {getSensorIcon(type)}
                    <Typography variant="body2" fontWeight="bold" sx={{ mt: 0.5 }}>
                      {active}/{count}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {type.toUpperCase()}
                    </Typography>
                  </Paper>
                </Grid>
              )
            })}
          </Grid>
        </Box>

        {/* Individual Sensors */}
        <Box>
          <Typography variant="subtitle2" gutterBottom fontWeight="bold">
            Individual Sensors ({sources.length})
          </Typography>
          <List sx={{ p: 0 }}>
            {sources
              .sort((a, b) => new Date(b.lastContact).getTime() - new Date(a.lastContact).getTime())
              .map(source => {
                const statusColor = getStatusColor(source.lastContact)
                const qualityColor = getQualityColor(source.dataQuality)
                const minutesAgo = Math.floor(
                  (currentTime - new Date(source.lastContact).getTime()) / 1000 / 60
                )

                return (
                  <Paper
                    key={source.sensorId}
                    variant="outlined"
                    sx={{
                      mb: 1,
                      '&:hover': {
                        bgcolor: 'action.hover',
                      },
                    }}
                  >
                    <ListItem>
                      <ListItemIcon>
                        <Box sx={{ position: 'relative' }}>
                          {getSensorIcon(source.sensorType)}
                          <StatusIcon
                            sx={{
                              position: 'absolute',
                              bottom: -4,
                              right: -4,
                              fontSize: 12,
                              color: `${statusColor}.main`,
                            }}
                          />
                        </Box>
                      </ListItemIcon>
                      <ListItemText
                        primary={
                          <Stack direction="row" spacing={1} alignItems="center">
                            <Typography variant="body2" fontWeight="bold">
                              {source.sensorName}
                            </Typography>
                            <Chip
                              label={source.sensorType.toUpperCase()}
                              size="small"
                              sx={{ height: 18, fontSize: '0.65rem' }}
                            />
                          </Stack>
                        }
                        secondary={
                          <Stack spacing={0.5} sx={{ mt: 0.5 }}>
                            <Typography variant="caption" color="text.secondary">
                              {source.location} | ID: {source.sensorId}
                            </Typography>
                            <Stack direction="row" spacing={2} alignItems="center">
                              <Box flex={1}>
                                <Typography variant="caption" color="text.secondary">
                                  Last Contact: {minutesAgo < 1 ? 'Just now' : `${minutesAgo}m ago`}
                                </Typography>
                              </Box>
                              <Box flex={1}>
                                <Typography variant="caption" color="text.secondary">
                                  Tracking: {source.trackingObjects} objects
                                </Typography>
                              </Box>
                            </Stack>
                            <Box>
                              <Stack direction="row" spacing={1} alignItems="center">
                                <Typography variant="caption" color="text.secondary">
                                  Data Quality:
                                </Typography>
                                <Box flex={1}>
                                  <LinearProgress
                                    variant="determinate"
                                    value={source.dataQuality}
                                    color={qualityColor}
                                    sx={{ height: 6, borderRadius: 1 }}
                                  />
                                </Box>
                                <Typography
                                  variant="caption"
                                  fontWeight="bold"
                                  color={`${qualityColor}.main`}
                                >
                                  {source.dataQuality}%
                                </Typography>
                              </Stack>
                            </Box>
                          </Stack>
                        }
                      />
                    </ListItem>
                  </Paper>
                )
              })}
          </List>
        </Box>

        {/* JSpOC Integration Notice */}
        <Paper
          variant="outlined"
          sx={{
            p: 2,
            bgcolor: 'primary.dark',
            color: 'primary.contrastText',
            border: '1px solid',
            borderColor: 'primary.main',
          }}
        >
          <Stack spacing={1}>
            <Typography variant="body2" fontWeight="bold">
              🛡️ JSpOC/18 SPCS Integration
            </Typography>
            <Typography variant="caption">
              Connected to Joint Space Operations Center (JSpOC) and 18th Space Control Squadron.
              Real-time data feed from Space Fence, GEODSS, and PAVE PAWS radar systems.
            </Typography>
            <Stack direction="row" spacing={1}>
              <Chip
                label="ENCRYPTED"
                size="small"
                sx={{ bgcolor: 'success.dark', color: 'white', fontSize: '0.7rem', height: 20 }}
              />
              <Chip
                label="LOW LATENCY"
                size="small"
                sx={{ bgcolor: 'info.dark', color: 'white', fontSize: '0.7rem', height: 20 }}
              />
              <Chip
                label="CDM ENABLED"
                size="small"
                sx={{ bgcolor: 'warning.dark', color: 'white', fontSize: '0.7rem', height: 20 }}
              />
            </Stack>
          </Stack>
        </Paper>
      </Stack>
    </Box>
  )
}

export default SSNDataFeed

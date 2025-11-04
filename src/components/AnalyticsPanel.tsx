import React, { useMemo } from 'react'
import { Box, Typography, Paper, Stack, LinearProgress } from '@mui/material'
import { TrendingUp as TrendingUpIcon, ShowChart as ChartIcon } from '@mui/icons-material'
import TimeSeriesChart from './TimeSeriesChart'
import { generateTimeSeriesData } from '../utils/orbitalCalculations'

interface AnalyticsPanelProps {
  satelliteName?: string
}

const AnalyticsPanel: React.FC<AnalyticsPanelProps> = ({ satelliteName }) => {
  // Mock data for metrics - memoized to prevent unnecessary re-renders
  const analyticsData = useMemo(
    () => [
      {
        title: 'Altitude Variation',
        current: 415.2,
        min: 408.6,
        max: 421.8,
        unit: 'km',
        trend: 'stable',
      },
      {
        title: 'Velocity Profile',
        current: 7.66,
        min: 7.64,
        max: 7.68,
        unit: 'km/s',
        trend: 'increasing',
      },
      {
        title: 'Conjunction Risk',
        current: 15,
        min: 0,
        max: 100,
        unit: '%',
        trend: 'decreasing',
      },
      {
        title: 'Orbital Decay Rate',
        current: 0.02,
        min: 0.01,
        max: 0.05,
        unit: 'km/day',
        trend: 'stable',
      },
    ],
    []
  )

  const getPercentage = (current: number, min: number, max: number) => {
    return ((current - min) / (max - min)) * 100
  }

  const getTrendColor = (trend: string) => {
    switch (trend) {
      case 'increasing':
        return 'info.main'
      case 'decreasing':
        return 'success.main'
      case 'stable':
        return 'text.secondary'
      default:
        return 'text.secondary'
    }
  }

  // Generate time-series data using the current metric values
  const timeSeriesData = useMemo(() => {
    const altitudeData = analyticsData.find(d => d.title === 'Altitude Variation')
    const velocityData = analyticsData.find(d => d.title === 'Velocity Profile')
    const conjunctionData = analyticsData.find(d => d.title === 'Conjunction Risk')
    const decayData = analyticsData.find(d => d.title === 'Orbital Decay Rate')

    return generateTimeSeriesData(
      altitudeData?.current,
      velocityData?.current,
      conjunctionData?.current,
      decayData?.current
    )
  }, [analyticsData])

  return (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <Box sx={{ p: 2, borderBottom: 1, borderColor: 'divider' }}>
        <Stack direction="row" spacing={1} alignItems="center">
          <ChartIcon color="primary" />
          <Typography variant="subtitle1" fontWeight={600}>
            Analytics
          </Typography>
        </Stack>
        {satelliteName && (
          <Typography variant="caption" color="text.secondary">
            {satelliteName}
          </Typography>
        )}
      </Box>

      <Box sx={{ flexGrow: 1, overflow: 'auto', p: 2 }}>
        <Stack spacing={2}>
          {analyticsData.map(data => (
            <Paper
              key={data.title}
              elevation={1}
              sx={{
                p: 2,
                border: '1px solid',
                borderColor: 'divider',
              }}
            >
              <Stack spacing={1.5}>
                <Box
                  sx={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                  }}
                >
                  <Typography variant="body2" fontWeight={600}>
                    {data.title}
                  </Typography>
                  <Stack direction="row" spacing={0.5} alignItems="center">
                    <TrendingUpIcon
                      sx={{
                        fontSize: 16,
                        color: getTrendColor(data.trend),
                        transform: data.trend === 'decreasing' ? 'rotate(180deg)' : 'none',
                      }}
                    />
                    <Typography
                      variant="caption"
                      sx={{ color: getTrendColor(data.trend), textTransform: 'capitalize' }}
                    >
                      {data.trend}
                    </Typography>
                  </Stack>
                </Box>

                <Box>
                  <Typography variant="h5" fontWeight={600}>
                    {data.current.toFixed(2)} {data.unit}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    Range: {data.min} - {data.max} {data.unit}
                  </Typography>
                </Box>

                <LinearProgress
                  variant="determinate"
                  value={getPercentage(data.current, data.min, data.max)}
                  sx={{
                    height: 8,
                    borderRadius: 1,
                    backgroundColor: 'action.hover',
                  }}
                />
              </Stack>
            </Paper>
          ))}
        </Stack>

        {/* Time-series chart */}
        <Paper
          elevation={1}
          sx={{
            mt: 2,
            p: 2,
            border: '1px solid',
            borderColor: 'divider',
          }}
        >
          <TimeSeriesChart data={timeSeriesData} />
        </Paper>
      </Box>
    </Box>
  )
}

export default AnalyticsPanel

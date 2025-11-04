import React, { useState } from 'react'
import {
  Box,
  Typography,
  Stack,
  ToggleButton,
  ToggleButtonGroup,
  useTheme,
  alpha,
  Theme,
} from '@mui/material'
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts'
import { TimeSeriesDataPoint } from '../utils/orbitalCalculations'

interface TimeSeriesChartProps {
  data: TimeSeriesDataPoint[]
  title?: string
}

interface MetricConfig {
  key: keyof Omit<TimeSeriesDataPoint, 'timestamp' | 'time'>
  label: string
  color: string
  unit: string
}

interface CustomTooltipProps {
  active?: boolean
  payload?: Array<{
    dataKey: string
    name: string
    value: number
    color: string
  }>
  label?: string
  theme: Theme
  metrics: MetricConfig[]
}

// Custom tooltip component - moved outside to prevent recreation on render
const CustomTooltip: React.FC<CustomTooltipProps> = ({ active, payload, label, theme, metrics }) => {
  if (active && payload && payload.length) {
    return (
      <Box
        sx={{
          backgroundColor: alpha(theme.palette.background.paper, 0.95),
          border: `1px solid ${theme.palette.divider}`,
          borderRadius: 1,
          p: 1.5,
          boxShadow: theme.shadows[4],
        }}
      >
        <Typography variant="body2" fontWeight={600} mb={0.5}>
          {label}
        </Typography>
        {payload.map((entry, index: number) => {
          const metric = metrics.find(m => m.key === entry.dataKey)
          return (
            <Box key={index} sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Box
                sx={{
                  width: 12,
                  height: 12,
                  borderRadius: '50%',
                  backgroundColor: entry.color,
                }}
              />
              <Typography variant="caption" color="text.secondary">
                {entry.name}:
              </Typography>
              <Typography variant="caption" fontWeight={600}>
                {typeof entry.value === 'number' ? entry.value.toFixed(3) : entry.value}{' '}
                {metric?.unit}
              </Typography>
            </Box>
          )
        })}
      </Box>
    )
  }
  return null
}

const TimeSeriesChart: React.FC<TimeSeriesChartProps> = ({
  data,
  title = 'Telemetry Trends - Last 24 Hours',
}) => {
  const theme = useTheme()

  const metrics: MetricConfig[] = [
    {
      key: 'altitude',
      label: 'Altitude',
      color: theme.palette.primary.main,
      unit: 'km',
    },
    {
      key: 'velocity',
      label: 'Velocity',
      color: theme.palette.success.main,
      unit: 'km/s',
    },
    {
      key: 'conjunctionRisk',
      label: 'Conjunction Risk',
      color: theme.palette.warning.main,
      unit: '%',
    },
    {
      key: 'orbitalDecay',
      label: 'Orbital Decay',
      color: theme.palette.error.main,
      unit: 'km/day',
    },
  ]

  const [selectedMetrics, setSelectedMetrics] = useState<string[]>(['altitude', 'velocity'])

  const handleMetricToggle = (_event: React.MouseEvent<HTMLElement>, newMetrics: string[]) => {
    // Ensure at least one metric is always selected
    if (newMetrics.length > 0) {
      setSelectedMetrics(newMetrics)
    }
  }

  // Format tick values based on the metric
  const formatYAxisTick = (value: number, metricKey: string) => {
    const metric = metrics.find(m => m.key === metricKey)
    if (!metric) return value.toString()

    if (metricKey === 'velocity' || metricKey === 'orbitalDecay') {
      return value.toFixed(3)
    }
    if (metricKey === 'conjunctionRisk') {
      return `${value.toFixed(0)}%`
    }
    return value.toFixed(1)
  }

  // Sample every nth point for cleaner X-axis labels
  const xAxisInterval = Math.floor(data.length / 8)

  return (
    <Box sx={{ width: '100%', height: '100%' }}>
      <Stack spacing={2}>
        <Box
          sx={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: 1,
          }}
        >
          <Typography variant="subtitle2" fontWeight={600}>
            {title}
          </Typography>
          <ToggleButtonGroup
            value={selectedMetrics}
            onChange={handleMetricToggle}
            size="small"
            sx={{
              '& .MuiToggleButton-root': {
                px: 1.5,
                py: 0.5,
                fontSize: '0.75rem',
                textTransform: 'none',
                border: '1px solid',
                borderColor: 'divider',
              },
            }}
          >
            {metrics.map(metric => (
              <ToggleButton
                key={metric.key}
                value={metric.key}
                sx={{
                  '&.Mui-selected': {
                    backgroundColor: alpha(metric.color, 0.15),
                    color: metric.color,
                    borderColor: metric.color,
                    '&:hover': {
                      backgroundColor: alpha(metric.color, 0.25),
                    },
                  },
                }}
              >
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                  <Box
                    sx={{
                      width: 8,
                      height: 8,
                      borderRadius: '50%',
                      backgroundColor: metric.color,
                    }}
                  />
                  {metric.label}
                </Box>
              </ToggleButton>
            ))}
          </ToggleButtonGroup>
        </Box>

        <Box sx={{ width: '100%', height: 300 }}>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
              <CartesianGrid
                strokeDasharray="3 3"
                stroke={alpha(theme.palette.divider, 0.5)}
                vertical={false}
              />
              <XAxis
                dataKey="time"
                tick={{ fontSize: 11, fill: theme.palette.text.secondary }}
                stroke={theme.palette.divider}
                interval={xAxisInterval}
              />
              <YAxis
                yAxisId="left"
                tick={{ fontSize: 11, fill: theme.palette.text.secondary }}
                stroke={theme.palette.divider}
                tickFormatter={value => formatYAxisTick(value, selectedMetrics[0] || 'altitude')}
              />
              {selectedMetrics.length > 1 && (
                <YAxis
                  yAxisId="right"
                  orientation="right"
                  tick={{ fontSize: 11, fill: theme.palette.text.secondary }}
                  stroke={theme.palette.divider}
                  tickFormatter={value => formatYAxisTick(value, selectedMetrics[1] || 'velocity')}
                />
              )}
              <Tooltip content={<CustomTooltip theme={theme} metrics={metrics} />} />
              <Legend wrapperStyle={{ fontSize: '12px', paddingTop: '10px' }} iconType="line" />
              {metrics.map((metric, index) => {
                if (!selectedMetrics.includes(metric.key)) return null

                const yAxisId = index === 0 || selectedMetrics.length === 1 ? 'left' : 'right'

                return (
                  <Line
                    key={metric.key}
                    type="monotone"
                    dataKey={metric.key}
                    stroke={metric.color}
                    strokeWidth={2}
                    dot={false}
                    name={metric.label}
                    yAxisId={yAxisId}
                    animationDuration={500}
                    activeDot={{ r: 4, strokeWidth: 0 }}
                  />
                )
              })}
            </LineChart>
          </ResponsiveContainer>
        </Box>
      </Stack>
    </Box>
  )
}

export default TimeSeriesChart

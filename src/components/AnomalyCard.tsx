import React from 'react'
import { Card, CardContent, Typography, Box, Chip, Stack } from '@mui/material'
import { ErrorOutline as AnomalyIcon, SatelliteAlt as SatIcon } from '@mui/icons-material'
import useNow from '../hooks/useNow'
import { formatAge } from '../utils/format'
import { SEVERITY_COLOR } from '../utils/riskStyle'

export interface AnomalyEventRow {
  id: number
  norad_id: string
  satellite_name: string
  anomaly_type: string
  severity: 'critical' | 'high' | 'medium' | 'low'
  detected_at: string
  parameter_name?: string
  expected_value?: number
  observed_value?: number
  deviation_sigma?: number
  anomaly_score?: number
  description?: string
  status: 'active' | 'investigating' | 'resolved'
}

const SEVERITY_BG: Record<string, string> = {
  critical: 'rgba(255,23,68,0.08)',
  high: 'rgba(255,109,0,0.08)',
  medium: 'rgba(255,171,0,0.08)',
  low: 'rgba(0,176,255,0.08)',
}

function formatType(t: string | null | undefined): string {
  if (!t) return ''
  return t.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
}

const STATUS_COLOR: Record<string, string> = {
  active: '#ef5350',
  investigating: '#ffa726',
  resolved: '#66bb6a',
}

interface AnomalyCardProps {
  anomaly: AnomalyEventRow
}

const AnomalyCard: React.FC<AnomalyCardProps> = ({ anomaly }) => {
  const now = useNow(60_000)
  // Timestamps slightly ahead of the clock read as "just now".
  const detectedAge = formatAge(Math.max(0, now - new Date(anomaly.detected_at).getTime()))
  const color = SEVERITY_COLOR[anomaly.severity ?? ''] || '#90a4ae'
  const bg = SEVERITY_BG[anomaly.severity ?? ''] || 'rgba(144,164,174,0.08)'

  return (
    <Card
      sx={{
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        border: '1px solid',
        borderColor: `${color}44`,
        borderTop: `3px solid ${color}`,
        backgroundColor: bg,
        transition: 'box-shadow 0.2s',
        '&:hover': { boxShadow: `0 0 0 1px ${color}88` },
      }}
    >
      <CardContent sx={{ pb: '12px !important' }}>
        {/* Header */}
        <Stack direction="row" justifyContent="space-between" alignItems="flex-start" mb={1}>
          <Stack direction="row" spacing={0.5} alignItems="center">
            <AnomalyIcon sx={{ fontSize: 14, color }} />
            <Typography variant="caption" fontWeight={700} sx={{ color, letterSpacing: 0.5 }}>
              {anomaly.severity?.toUpperCase()}
            </Typography>
          </Stack>
          <Chip
            label={anomaly.status?.toUpperCase()}
            size="small"
            sx={{
              height: 18,
              fontSize: '0.58rem',
              fontWeight: 700,
              bgcolor: `${STATUS_COLOR[anomaly.status]}22`,
              color: STATUS_COLOR[anomaly.status],
            }}
          />
        </Stack>

        {/* Satellite */}
        <Stack direction="row" spacing={0.75} alignItems="center" mb={0.5}>
          <SatIcon sx={{ fontSize: 14, color: 'text.secondary' }} />
          <Typography variant="subtitle2" fontWeight={700} noWrap>
            {anomaly.satellite_name}
          </Typography>
        </Stack>

        {/* Anomaly type */}
        <Typography variant="body2" color="text.secondary" mb={1} fontWeight={500}>
          {formatType(anomaly.anomaly_type)}
        </Typography>

        {/* Metrics */}
        <Stack direction="row" spacing={2} mb={1}>
          {anomaly.deviation_sigma != null && (
            <Box>
              <Typography variant="caption" color="text.disabled" display="block">
                Deviation
              </Typography>
              <Typography variant="body2" fontWeight={700} sx={{ color }}>
                {anomaly.deviation_sigma.toFixed(1)}σ
              </Typography>
            </Box>
          )}
          {anomaly.parameter_name && (
            <Box>
              <Typography variant="caption" color="text.disabled" display="block">
                Parameter
              </Typography>
              <Typography variant="body2" fontWeight={600}>
                {anomaly.parameter_name.replace(/_/g, ' ')}
              </Typography>
            </Box>
          )}
          {anomaly.anomaly_score != null && (
            <Box>
              <Typography variant="caption" color="text.disabled" display="block">
                Score
              </Typography>
              <Typography variant="body2" fontWeight={600}>
                {(anomaly.anomaly_score * 100).toFixed(0)}%
              </Typography>
            </Box>
          )}
        </Stack>

        {/* Description */}
        {anomaly.description && (
          <Typography
            variant="caption"
            color="text.secondary"
            sx={{
              display: '-webkit-box',
              WebkitLineClamp: 2,
              WebkitBoxOrient: 'vertical',
              overflow: 'hidden',
              mb: 0.75,
            }}
          >
            {anomaly.description}
          </Typography>
        )}

        {/* Time and provenance */}
        <Typography variant="caption" color="text.disabled" display="block">
          Detected {detectedAge} {'\u00b7'} NORAD {anomaly.norad_id} {'\u00b7'} Simulated
        </Typography>
      </CardContent>
    </Card>
  )
}

export default AnomalyCard

import React, { useEffect, useState } from 'react'
import { Box, Button, Chip, CircularProgress, Paper, Stack, Typography } from '@mui/material'
import {
  SmartToy as AIIcon,
  Warning as WarningIcon,
  Error as ErrorIcon,
  CheckCircle as CheckIcon,
  Info as InfoIcon,
  AccessTime as TimeIcon,
} from '@mui/icons-material'
import { AIRecommendation } from '../types'
import { fetchJson } from '../services/api'
import useNow from '../hooks/useNow'
import { formatTcaCountdown, formatUtc } from '../utils/format'
import { openAssistant } from '../utils/assistant'

interface AITwinPanelProps {
  recommendations?: AIRecommendation[]
  onSensorHighlight?: (sensors: string[]) => void
  onSnapToTime?: (time: Date) => void
  /** NORAD IDs to scope advisories to (normally the event pair). */
  noradIds?: string[]
  /** Prompt for the "Analyze with assistant" action. */
  analysisPrompt?: string
}

/** /api/recommendations row: the affected objects arrive as `affectedObjects`. */
type RecommendationRow = AIRecommendation & { affectedObjects?: string[] }

const PRIORITY_ICON: Record<AIRecommendation['priority'], React.ReactNode> = {
  critical: <ErrorIcon sx={{ fontSize: 20, color: 'error.main' }} />,
  high: <WarningIcon sx={{ fontSize: 20, color: 'warning.main' }} />,
  medium: <InfoIcon sx={{ fontSize: 20, color: 'info.main' }} />,
  low: <CheckIcon sx={{ fontSize: 20, color: 'success.main' }} />,
}

const PRIORITY_COLOR: Record<
  AIRecommendation['priority'],
  'error' | 'warning' | 'info' | 'success'
> = {
  critical: 'error',
  high: 'warning',
  medium: 'info',
  low: 'success',
}

const typeLabel = (type: string) =>
  type
    .split('-')
    .map((w, i) => (i === 0 ? w.charAt(0).toUpperCase() + w.slice(1) : w))
    .join(' ')

const AITwinPanel: React.FC<AITwinPanelProps> = ({
  recommendations: propRecs = [],
  onSensorHighlight,
  onSnapToTime,
  noradIds,
  analysisPrompt,
}) => {
  const noradKey = (noradIds ?? []).join(',')
  const [live, setLive] = useState<{ key: string; recs: AIRecommendation[] } | null>(null)
  const now = useNow(1000)

  useEffect(() => {
    let cancelled = false
    const params = new URLSearchParams()
    if (noradKey) params.set('norad_ids', noradKey)
    fetchJson<RecommendationRow[]>(`/api/recommendations?${params}`)
      .then(data => (Array.isArray(data) ? data : []))
      .catch(() => [] as RecommendationRow[])
      .then(rows => {
        if (cancelled) return
        setLive({
          key: noradKey,
          recs: rows.map(({ affectedObjects, ...r }) => ({
            ...r,
            affectedSensors: affectedObjects ?? r.affectedSensors,
          })),
        })
      })
    return () => {
      cancelled = true
    }
  }, [noradKey])

  const loading = live?.key !== noradKey
  const liveRecs = live && !loading ? live.recs : []
  const source = liveRecs.length > 0 ? liveRecs : propRecs
  const isLive = liveRecs.length > 0
  // Advice applies before TCA only; the timestamp on each advisory is its event's TCA.
  const upcoming = source
    .filter(r => !r.timestamp || new Date(r.timestamp).getTime() > now)
    .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())
  const passedCount = source.length - upcoming.length

  return (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <Box sx={{ p: 2, borderBottom: 1, borderColor: 'divider' }}>
        <Stack direction="row" spacing={1} alignItems="center">
          <AIIcon color="primary" />
          <Typography variant="subtitle1" fontWeight={600}>
            Advisories
          </Typography>
          {loading ? (
            <CircularProgress size={12} />
          ) : (
            <Chip
              label={isLive ? 'LIVE' : 'NONE'}
              size="small"
              sx={{
                height: 16,
                fontSize: '0.6rem',
                fontWeight: 700,
                bgcolor: isLive ? 'rgba(0,230,118,0.15)' : 'rgba(255,255,255,0.08)',
                color: isLive ? '#00e676' : 'text.secondary',
              }}
            />
          )}
        </Stack>
        <Typography variant="caption" color="text.secondary" display="block">
          Rule-based advisories for this pair from the ML Pc. The assistant can analyze the event in
          depth.
        </Typography>
        {analysisPrompt && (
          <Button
            size="small"
            variant="outlined"
            startIcon={<AIIcon />}
            onClick={() => openAssistant({ tab: 'chat', prompt: analysisPrompt })}
            sx={{ mt: 1.25, textTransform: 'none' }}
          >
            Analyze with assistant
          </Button>
        )}
      </Box>

      <Box sx={{ flexGrow: 1, overflow: 'auto', p: 2 }}>
        {upcoming.map(rec => (
          <Paper
            key={rec.id}
            elevation={1}
            onClick={() => {
              if (onSnapToTime && rec.timestamp) onSnapToTime(new Date(rec.timestamp))
            }}
            sx={{
              mb: 2,
              p: 2,
              border: '1px solid',
              borderColor: 'divider',
              '&:last-child': { mb: 0 },
              cursor: onSnapToTime ? 'pointer' : 'default',
              transition: 'border-color 0.2s, background-color 0.2s',
              '&:hover': onSnapToTime
                ? { borderColor: 'primary.main', bgcolor: 'rgba(33, 150, 243, 0.04)' }
                : {},
            }}
          >
            <Stack spacing={1.25}>
              <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1 }}>
                {PRIORITY_ICON[rec.priority] ?? PRIORITY_ICON.medium}
                <Box sx={{ flexGrow: 1, minWidth: 0 }}>
                  <Typography variant="body2" fontWeight={600}>
                    {typeLabel(rec.type)}
                  </Typography>
                  {rec.timestamp && (
                    <Stack direction="row" spacing={0.5} alignItems="center">
                      <TimeIcon sx={{ fontSize: 12, color: 'text.disabled' }} />
                      <Typography variant="caption" color="text.secondary">
                        {formatTcaCountdown(new Date(rec.timestamp).getTime(), now)} {'·'}{' '}
                        {formatUtc(rec.timestamp)}
                      </Typography>
                    </Stack>
                  )}
                </Box>
                <Chip
                  label={rec.priority}
                  size="small"
                  color={PRIORITY_COLOR[rec.priority] ?? 'default'}
                  sx={{ textTransform: 'capitalize' }}
                />
              </Box>

              <Typography variant="body2" color="text.secondary">
                {rec.description}
              </Typography>

              {rec.affectedSensors && rec.affectedSensors.length > 0 && (
                <Stack direction="row" spacing={0.5} flexWrap="wrap" useFlexGap>
                  {rec.affectedSensors.map(obj => (
                    <Chip
                      key={obj}
                      label={obj}
                      size="small"
                      variant="outlined"
                      sx={{ fontSize: '0.7rem', height: 22 }}
                      onClick={
                        onSensorHighlight
                          ? () => onSensorHighlight(rec.affectedSensors ?? [])
                          : undefined
                      }
                    />
                  ))}
                </Stack>
              )}
            </Stack>
          </Paper>
        ))}

        {!loading && upcoming.length === 0 && (
          <Box
            sx={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              height: '100%',
              gap: 1.5,
              textAlign: 'center',
            }}
          >
            <AIIcon sx={{ fontSize: 48, color: 'text.disabled' }} />
            <Typography variant="body2" color="text.secondary">
              {passedCount > 0
                ? 'No open advisories. TCA has passed for this pair.'
                : 'No advisories for this pair.'}
            </Typography>
          </Box>
        )}
        {!loading && upcoming.length > 0 && passedCount > 0 && (
          <Typography variant="caption" color="text.disabled" display="block" sx={{ mt: 1.5 }}>
            {passedCount} advisor{passedCount === 1 ? 'y' : 'ies'} hidden because TCA has passed.
          </Typography>
        )}
      </Box>
    </Box>
  )
}

export default AITwinPanel

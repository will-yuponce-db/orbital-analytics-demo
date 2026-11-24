import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  Box,
  Chip,
  CircularProgress,
  IconButton,
  Paper,
  Slider,
  Stack,
  Tooltip,
  Typography,
} from '@mui/material'
import {
  TrackChanges as ConjunctionIcon,
  ErrorOutline as AnomalyIcon,
  PlayArrow as PlayIcon,
  Pause as PauseIcon,
  SkipNext as NextIcon,
  SkipPrevious as PrevIcon,
  Replay as ResetIcon,
  AccessTime as TimeIcon,
} from '@mui/icons-material'
import { fetchJson } from '../services/api'
import useNow from '../hooks/useNow'
import useConjunctionEvents from '../hooks/useConjunctionEvents'
import type { ConjunctionView } from '../utils/conjunctions'
import { formatDuration, formatMissDistance, formatPc, formatUtc } from '../utils/format'
import { SEVERITY_COLOR, TIER_COLOR } from '../utils/riskStyle'

interface TimelineEvent {
  type: 'conjunction' | 'anomaly'
  id: string
  cdmId?: string
  eventTime: string
  label: string
  sublabel: string
  severity: string
  status: string
  description?: string
}

const COLOR: Record<string, string> = { ...TIER_COLOR, ...SEVERITY_COLOR }
const colorOf = (severity: string) => COLOR[severity] || '#90a4ae'

function relative(iso: string, now: number): string {
  const diff = new Date(iso).getTime() - now
  return diff >= 0 ? `in ${formatDuration(diff)}` : `${formatDuration(diff)} ago`
}

interface TimelinePanelProps {
  onEventSelect?: (event: TimelineEvent | null) => void
  /** With onTimeChange, the panel follows the scenario clock: the selected event is the one nearest to it. */
  currentTime?: Date
  onTimeChange?: (time: Date) => void
}

const TimelinePanel: React.FC<TimelinePanelProps> = ({
  onEventSelect,
  currentTime,
  onTimeChange,
}) => {
  const now = useNow(30_000)
  const [raw, setRaw] = useState<TimelineEvent[] | null>(null)
  const [localIndex, setLocalIndex] = useState(0)
  const [playing, setPlaying] = useState(false)
  const eventRefs = useRef<(HTMLDivElement | null)[]>([])
  const { events: conjunctions } = useConjunctionEvents()

  useEffect(() => {
    fetchJson<TimelineEvent[]>('/api/timeline')
      .then(data => setRaw(Array.isArray(data) ? data : []))
      .catch(() => setRaw([]))
  }, [])

  // One entry per conjunction event, with miss distance and Pc formatted from
  // the event list; chronological for playback.
  const events = useMemo(() => {
    if (!raw) return []
    const byCdm = new Map<string, ConjunctionView>()
    for (const c of conjunctions ?? []) for (const id of c.cdmIds) byCdm.set(id, c)
    const seen = new Set<string>()
    const out: TimelineEvent[] = []
    for (const e of raw) {
      if (e.type === 'conjunction' && e.cdmId) {
        const c = byCdm.get(e.cdmId)
        if (c) {
          if (seen.has(c.eventKey)) continue
          seen.add(c.eventKey)
          out.push({
            ...e,
            eventTime: c.tca,
            label: `${c.satelliteA.name} × ${c.satelliteB.name}`,
            sublabel: `Miss ${formatMissDistance(c.missDistanceM)} · Pc (18 SDS) ${formatPc(c.rawPc)}`,
            severity: c.riskTier,
          })
          continue
        }
      }
      out.push(e.type === 'anomaly' ? { ...e, sublabel: `${e.sublabel} · simulated` } : e)
    }
    return out.sort((a, b) => new Date(a.eventTime).getTime() - new Date(b.eventTime).getTime())
  }, [raw, conjunctions])

  const controlled = !!currentTime && !!onTimeChange
  const clockMs = currentTime?.getTime()
  const nearest = useMemo(() => {
    if (clockMs === undefined || events.length === 0) return 0
    let best = 0
    let bestDist = Infinity
    events.forEach((e, i) => {
      const d = Math.abs(new Date(e.eventTime).getTime() - clockMs)
      if (d < bestDist) {
        bestDist = d
        best = i
      }
    })
    return best
  }, [events, clockMs])
  const currentIndex = Math.min(controlled ? nearest : localIndex, Math.max(0, events.length - 1))
  const currentEvent = events[currentIndex]

  const select = useCallback(
    (idx: number) => {
      const evt = events[idx]
      if (!evt) return
      setLocalIndex(idx)
      onEventSelect?.(evt)
      onTimeChange?.(new Date(evt.eventTime))
    },
    [events, onEventSelect, onTimeChange]
  )

  const goTo = (idx: number) => {
    setPlaying(false)
    select(idx)
  }

  // Playback steps through events every two seconds.
  const indexRef = useRef(currentIndex)
  useEffect(() => {
    indexRef.current = currentIndex
  }, [currentIndex])
  useEffect(() => {
    if (!playing) return
    const id = window.setInterval(() => {
      const next = indexRef.current + 1
      if (next >= events.length) {
        setPlaying(false)
        return
      }
      indexRef.current = next
      select(next)
    }, 2000)
    return () => window.clearInterval(id)
  }, [playing, events.length, select])

  useEffect(() => {
    eventRefs.current[currentIndex]?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
  }, [currentIndex])

  const loading = raw === null
  const conjCount = events.filter(e => e.type === 'conjunction').length
  const anomCount = events.length - conjCount
  const color = currentEvent ? colorOf(currentEvent.severity) : '#90a4ae'

  return (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <Box sx={{ p: 2, borderBottom: 1, borderColor: 'divider' }}>
        <Stack direction="row" alignItems="center" spacing={1} mb={0.5}>
          <TimeIcon sx={{ fontSize: 18, color: 'text.secondary' }} />
          <Typography variant="subtitle1" fontWeight={600}>
            Event playback
          </Typography>
          {loading && <CircularProgress size={12} />}
        </Stack>
        <Typography variant="caption" color="text.secondary">
          {conjCount} conjunction{conjCount === 1 ? '' : 's'} (Space-Track) and {anomCount}{' '}
          simulated anomal{anomCount === 1 ? 'y' : 'ies'}, in time order. Selecting one moves the
          scenario clock.
        </Typography>
      </Box>

      {currentEvent && (
        <Box sx={{ px: 2, pt: 1.5, pb: 1, borderBottom: 1, borderColor: 'divider' }}>
          <Paper
            elevation={0}
            sx={{
              p: 1.5,
              bgcolor: `${color}11`,
              border: '1px solid',
              borderColor: `${color}44`,
              borderRadius: 2,
            }}
          >
            <Stack direction="row" spacing={1} alignItems="flex-start">
              <Box
                sx={{
                  width: 32,
                  height: 32,
                  borderRadius: '50%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  bgcolor: `${color}22`,
                  border: `1.5px solid ${color}`,
                  flexShrink: 0,
                  mt: 0.25,
                }}
              >
                {currentEvent.type === 'conjunction' ? (
                  <ConjunctionIcon sx={{ fontSize: 16, color }} />
                ) : (
                  <AnomalyIcon sx={{ fontSize: 16, color }} />
                )}
              </Box>
              <Box sx={{ flexGrow: 1, minWidth: 0 }}>
                <Stack direction="row" spacing={0.5} mb={0.5}>
                  <Chip
                    label={
                      currentEvent.type === 'conjunction' ? 'CONJUNCTION' : 'ANOMALY · SIMULATED'
                    }
                    size="small"
                    sx={{
                      height: 16,
                      fontSize: '0.6rem',
                      fontWeight: 700,
                      bgcolor: `${color}22`,
                      color,
                    }}
                  />
                  <Chip
                    label={currentEvent.severity?.toUpperCase()}
                    size="small"
                    sx={{
                      height: 16,
                      fontSize: '0.6rem',
                      fontWeight: 700,
                      bgcolor: `${color}33`,
                      color,
                    }}
                  />
                </Stack>
                <Typography variant="body2" fontWeight={600} noWrap title={currentEvent.label}>
                  {currentEvent.label}
                </Typography>
                <Typography variant="caption" color="text.secondary" noWrap display="block">
                  {currentEvent.sublabel}
                </Typography>
                <Typography variant="caption" color="text.disabled" display="block" mt={0.25}>
                  {formatUtc(currentEvent.eventTime)} {'·'} {relative(currentEvent.eventTime, now)}
                </Typography>
              </Box>
              <Typography variant="caption" color="text.disabled" sx={{ flexShrink: 0, pt: 0.25 }}>
                {currentIndex + 1}/{events.length}
              </Typography>
            </Stack>
          </Paper>
        </Box>
      )}

      <Box sx={{ px: 2, py: 1, borderBottom: 1, borderColor: 'divider' }}>
        <Stack direction="row" alignItems="center" spacing={0.5} mb={1}>
          <Tooltip title="Back to the first event">
            <span>
              <IconButton
                size="small"
                onClick={() => goTo(0)}
                disabled={loading || events.length === 0}
              >
                <ResetIcon fontSize="small" />
              </IconButton>
            </span>
          </Tooltip>
          <Tooltip title="Previous event">
            <span>
              <IconButton
                size="small"
                onClick={() => goTo(Math.max(0, currentIndex - 1))}
                disabled={currentIndex === 0 || loading}
              >
                <PrevIcon fontSize="small" />
              </IconButton>
            </span>
          </Tooltip>
          <Tooltip title={playing ? 'Pause' : 'Play through events'}>
            <span>
              <IconButton
                size="small"
                onClick={() => setPlaying(p => !p)}
                disabled={loading || events.length === 0}
                sx={{
                  bgcolor: playing ? 'primary.main' : 'action.hover',
                  '&:hover': { bgcolor: playing ? 'primary.dark' : 'action.selected' },
                  color: playing ? 'white' : 'inherit',
                }}
              >
                {playing ? <PauseIcon fontSize="small" /> : <PlayIcon fontSize="small" />}
              </IconButton>
            </span>
          </Tooltip>
          <Tooltip title="Next event">
            <span>
              <IconButton
                size="small"
                onClick={() => goTo(Math.min(events.length - 1, currentIndex + 1))}
                disabled={currentIndex >= events.length - 1 || loading}
              >
                <NextIcon fontSize="small" />
              </IconButton>
            </span>
          </Tooltip>
        </Stack>
        {events.length > 1 && (
          <Slider
            size="small"
            min={0}
            max={events.length - 1}
            value={currentIndex}
            onChange={(_e: Event, v: number | number[]) => goTo(v as number)}
            disabled={loading}
            aria-label="Event"
            sx={{ py: 0.5, color }}
          />
        )}
      </Box>

      <Box sx={{ flexGrow: 1, overflow: 'auto' }}>
        {loading && (
          <Box sx={{ display: 'flex', justifyContent: 'center', pt: 4 }}>
            <CircularProgress size={28} />
          </Box>
        )}
        {!loading && events.length === 0 && (
          <Typography variant="body2" color="text.secondary" sx={{ p: 3, textAlign: 'center' }}>
            No events to play back.
          </Typography>
        )}
        {events.map((evt, idx) => {
          const c = colorOf(evt.severity)
          const isSelected = idx === currentIndex
          return (
            <Box
              key={`${evt.type}-${evt.id}`}
              ref={(el: HTMLDivElement | null) => {
                eventRefs.current[idx] = el
              }}
              onClick={() => goTo(idx)}
              sx={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: 1.5,
                px: 2,
                py: 1,
                cursor: 'pointer',
                backgroundColor: isSelected ? `${c}15` : 'transparent',
                borderLeft: isSelected ? `3px solid ${c}` : '3px solid transparent',
                transition: 'all 0.15s',
                '&:hover': { backgroundColor: isSelected ? `${c}20` : 'action.hover' },
              }}
            >
              <Box
                sx={{
                  width: 20,
                  height: 20,
                  borderRadius: '50%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  bgcolor: `${c}22`,
                  border: `1.5px solid ${c}`,
                  flexShrink: 0,
                  mt: 0.25,
                }}
              >
                {evt.type === 'conjunction' ? (
                  <ConjunctionIcon sx={{ fontSize: 10, color: c }} />
                ) : (
                  <AnomalyIcon sx={{ fontSize: 10, color: c }} />
                )}
              </Box>
              <Box sx={{ flexGrow: 1, minWidth: 0 }}>
                <Typography
                  variant="caption"
                  fontWeight={isSelected ? 700 : 500}
                  noWrap
                  display="block"
                  color={isSelected ? c : 'text.primary'}
                >
                  {evt.label}
                </Typography>
                <Typography variant="caption" color="text.disabled" display="block" noWrap>
                  {formatUtc(evt.eventTime)}
                  {evt.type === 'anomaly' ? ' · simulated anomaly' : ''}
                </Typography>
              </Box>
              <Typography variant="caption" color="text.disabled" sx={{ flexShrink: 0 }}>
                {idx + 1}
              </Typography>
            </Box>
          )
        })}
      </Box>
    </Box>
  )
}

export default TimelinePanel

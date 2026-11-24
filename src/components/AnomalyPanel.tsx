import { useEffect, useState, useCallback } from 'react'
import {
  Box,
  Typography,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
  Button,
  CircularProgress,
  Collapse,
  IconButton,
  Paper,
} from '@mui/material'
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown'
import KeyboardArrowUpIcon from '@mui/icons-material/KeyboardArrowUp'
import { AnomalyEvent } from '../types'

// ---------------------------------------------------------------------------
// Theme constants
// ---------------------------------------------------------------------------
const BG_PAGE = '#0a0e1a'
const BG_PAPER = '#0d1321'
const BORDER = 'rgba(255,255,255,0.1)'

const SEVERITY_COLOR: Record<string, string> = {
  critical: '#ff1744',
  high: '#ff6d00',
  medium: '#ffab00',
  low: '#00b0ff',
}

const ANOMALY_TYPE_LABEL: Record<AnomalyEvent['anomalyType'], string> = {
  'altitude-drop': '↓ Altitude Drop',
  'velocity-spike': '↑ Velocity Spike',
  'eccentricity-change': '⬡ Eccentricity Change',
  'inclination-drift': '↗ Inclination Drift',
  'orbital-decay': '↻ Orbital Decay',
  'maneuver-unplanned': '⚡ Unplanned Maneuver',
}

// ---------------------------------------------------------------------------
// Helper: map snake_case DB row to camelCase AnomalyEvent
// ---------------------------------------------------------------------------
function mapRow(row: Record<string, unknown>): AnomalyEvent {
  const num = (a: unknown, b: unknown) => parseFloat(String(a ?? b)) || 0
  return {
    id: Number(row.id),
    noradId: String(row.norad_id ?? row.noradId ?? ''),
    satelliteName: String(row.satellite_name ?? row.satelliteName ?? ''),
    anomalyType: (row.anomaly_type ?? row.anomalyType) as AnomalyEvent['anomalyType'],
    severity: row.severity as AnomalyEvent['severity'],
    detectedAt: String(row.detected_at ?? row.detectedAt ?? ''),
    parameterName: String(row.parameter_name ?? row.parameterName ?? ''),
    expectedValue: num(row.expected_value, row.expectedValue),
    observedValue: num(row.observed_value, row.observedValue),
    deviationSigma: num(row.deviation_sigma, row.deviationSigma),
    anomalyScore: num(row.anomaly_score, row.anomalyScore),
    description: String(row.description ?? ''),
    status: row.status as AnomalyEvent['status'],
  }
}

// ---------------------------------------------------------------------------
// Expandable row sub-component
// ---------------------------------------------------------------------------
interface RowProps {
  event: AnomalyEvent
  onStatusChange: (id: number, status: AnomalyEvent['status']) => void
}

function AnomalyRow({ event, onStatusChange }: RowProps) {
  const [open, setOpen] = useState(false)

  const sevColor = SEVERITY_COLOR[event.severity] ?? '#90caf9'

  const formatDate = (iso: string) => {
    const d = new Date(iso)
    return d.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    })
  }

  const cellSx = {
    color: 'rgba(255,255,255,0.87)',
    borderBottom: `1px solid ${BORDER}`,
    py: 1,
    px: 1.5,
    fontSize: '0.8rem',
  }

  return (
    <>
      <TableRow
        sx={{
          '&:hover': { bgcolor: 'rgba(255,255,255,0.03)' },
          cursor: 'default',
        }}
      >
        {/* Expand toggle */}
        <TableCell sx={{ ...cellSx, width: 32, pr: 0 }}>
          <IconButton
            size="small"
            onClick={() => setOpen(!open)}
            sx={{ color: 'rgba(255,255,255,0.4)', p: 0.25 }}
          >
            {open ? (
              <KeyboardArrowUpIcon fontSize="small" />
            ) : (
              <KeyboardArrowDownIcon fontSize="small" />
            )}
          </IconButton>
        </TableCell>

        {/* Satellite */}
        <TableCell sx={cellSx}>
          <Typography sx={{ fontSize: '0.8rem', fontWeight: 600, color: '#e3f2fd' }}>
            {event.satelliteName}
          </Typography>
          <Typography sx={{ fontSize: '0.68rem', color: 'rgba(255,255,255,0.4)' }}>
            NORAD {event.noradId}
          </Typography>
        </TableCell>

        {/* Anomaly Type */}
        <TableCell sx={cellSx}>
          {ANOMALY_TYPE_LABEL[event.anomalyType] ?? event.anomalyType}
        </TableCell>

        {/* Severity */}
        <TableCell sx={cellSx}>
          <Chip
            label={event.severity.toUpperCase()}
            size="small"
            sx={{
              bgcolor: `${sevColor}22`,
              color: sevColor,
              border: `1px solid ${sevColor}66`,
              fontWeight: 700,
              fontSize: '0.65rem',
              height: 20,
            }}
          />
        </TableCell>

        {/* Parameter */}
        <TableCell sx={cellSx}>{event.parameterName}</TableCell>

        {/* Deviation */}
        <TableCell sx={{ ...cellSx, color: sevColor, fontWeight: 600 }}>
          {(event.deviationSigma ?? 0).toFixed(2)}σ
        </TableCell>

        {/* AI Score */}
        <TableCell sx={cellSx}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
            <Box
              sx={{
                width: 36,
                height: 4,
                borderRadius: 2,
                bgcolor: BORDER,
                overflow: 'hidden',
              }}
            >
              <Box
                sx={{
                  width: `${Math.round((event.anomalyScore ?? 0) * 100)}%`,
                  height: '100%',
                  bgcolor: sevColor,
                  borderRadius: 2,
                }}
              />
            </Box>
            <Typography sx={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.7)' }}>
              {(event.anomalyScore ?? 0).toFixed(3)}
            </Typography>
          </Box>
        </TableCell>

        {/* Detected */}
        <TableCell sx={{ ...cellSx, color: 'rgba(255,255,255,0.55)', fontSize: '0.72rem' }}>
          {formatDate(event.detectedAt)}
        </TableCell>

        {/* Status */}
        <TableCell sx={cellSx}>
          <Chip
            label={event.status}
            size="small"
            sx={{
              bgcolor:
                event.status === 'resolved'
                  ? 'rgba(0,230,118,0.12)'
                  : event.status === 'investigating'
                    ? 'rgba(255,171,0,0.12)'
                    : 'rgba(144,202,249,0.1)',
              color:
                event.status === 'resolved'
                  ? '#00e676'
                  : event.status === 'investigating'
                    ? '#ffab00'
                    : 'rgba(255,255,255,0.6)',
              fontSize: '0.65rem',
              height: 20,
            }}
          />
        </TableCell>

        {/* Actions */}
        <TableCell sx={{ ...cellSx, whiteSpace: 'nowrap' }}>
          {event.status === 'active' && (
            <Button
              size="small"
              variant="outlined"
              onClick={() => onStatusChange(event.id, 'investigating')}
              sx={{
                fontSize: '0.65rem',
                py: 0.25,
                px: 1,
                mr: 0.5,
                borderColor: '#ffab00',
                color: '#ffab00',
                '&:hover': { bgcolor: 'rgba(255,171,0,0.08)', borderColor: '#ffab00' },
                minWidth: 0,
              }}
            >
              Investigate
            </Button>
          )}
          {event.status !== 'resolved' && (
            <Button
              size="small"
              variant="outlined"
              onClick={() => onStatusChange(event.id, 'resolved')}
              sx={{
                fontSize: '0.65rem',
                py: 0.25,
                px: 1,
                borderColor: '#00e676',
                color: '#00e676',
                '&:hover': { bgcolor: 'rgba(0,230,118,0.08)', borderColor: '#00e676' },
                minWidth: 0,
              }}
            >
              Resolve
            </Button>
          )}
        </TableCell>
      </TableRow>

      {/* Expandable description row */}
      <TableRow>
        <TableCell colSpan={10} sx={{ py: 0, borderBottom: open ? `1px solid ${BORDER}` : 'none' }}>
          <Collapse in={open} timeout="auto" unmountOnExit>
            <Box sx={{ px: 3, py: 1.5, bgcolor: 'rgba(255,255,255,0.02)' }}>
              <Typography sx={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.65)', mb: 0.5 }}>
                {event.description}
              </Typography>
              <Box sx={{ display: 'flex', gap: 3, mt: 0.5 }}>
                <Typography sx={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.4)' }}>
                  Expected:{' '}
                  <span style={{ color: 'rgba(255,255,255,0.7)' }}>{event.expectedValue}</span>
                </Typography>
                <Typography sx={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.4)' }}>
                  Observed:{' '}
                  <span style={{ color: SEVERITY_COLOR[event.severity] }}>
                    {event.observedValue}
                  </span>
                </Typography>
                <Typography sx={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.4)' }}>
                  ID: <span style={{ color: 'rgba(255,255,255,0.5)' }}>{event.id}</span>
                </Typography>
              </Box>
            </Box>
          </Collapse>
        </TableCell>
      </TableRow>
    </>
  )
}

// ---------------------------------------------------------------------------
// Main AnomalyPanel component
// ---------------------------------------------------------------------------
export default function AnomalyPanel({ noradIds }: { noradIds?: string[] } = {}) {
  const [events, setEvents] = useState<AnomalyEvent[]>([])
  const [loading, setLoading] = useState(true)
  const noradKey = (noradIds ?? []).join(',')

  const fetchAnomalies = useCallback(async () => {
    try {
      const params = new URLSearchParams()
      if (noradKey) params.set('norad_ids', noradKey)
      const res = await fetch(`/api/anomalies?${params}`)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data: unknown = await res.json()
      setEvents(Array.isArray(data) ? data.map(r => mapRow(r as Record<string, unknown>)) : [])
    } catch {
      setEvents([])
    } finally {
      setLoading(false)
    }
  }, [noradKey])

  useEffect(() => {
    fetchAnomalies()
  }, [fetchAnomalies])

  const handleStatusChange = useCallback(async (id: number, status: AnomalyEvent['status']) => {
    try {
      const res = await fetch(`/api/anomalies/${id}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      })
      if (res.ok) {
        setEvents(prev => prev.map(e => (e.id === id ? { ...e, status } : e)))
      }
    } catch {
      // Optimistic update even on network error (mock mode)
      setEvents(prev => prev.map(e => (e.id === id ? { ...e, status } : e)))
    }
  }, [])

  // Summary counts
  const counts = events.reduce(
    (acc, e) => {
      acc[e.severity] = (acc[e.severity] ?? 0) + 1
      return acc
    },
    {} as Record<string, number>
  )

  const headerCellSx = {
    color: 'rgba(255,255,255,0.45)',
    borderBottom: `1px solid ${BORDER}`,
    fontSize: '0.7rem',
    fontWeight: 600,
    textTransform: 'uppercase' as const,
    letterSpacing: '0.06em',
    py: 1,
    px: 1.5,
    bgcolor: BG_PAPER,
  }

  return (
    <Box
      sx={{
        bgcolor: BG_PAGE,
        minHeight: '100%',
        p: 2,
        fontFamily: '"Inter", "Roboto Mono", monospace',
      }}
    >
      {/* Header */}
      <Box
        sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', mb: 2 }}
      >
        <Box>
          <Typography
            variant="h6"
            sx={{ color: '#e3f2fd', fontWeight: 700, letterSpacing: '0.04em', fontSize: '1rem' }}
          >
            Orbital Anomaly Detection
          </Typography>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, mt: 0.5 }}>
            <Chip
              label="SIMULATED"
              size="small"
              variant="outlined"
              sx={{
                height: 18,
                fontSize: '0.58rem',
                fontWeight: 700,
                color: 'rgba(255,255,255,0.6)',
                borderColor: 'rgba(255,255,255,0.25)',
              }}
            />
            <Typography sx={{ color: 'rgba(255,255,255,0.45)', fontSize: '0.72rem' }}>
              Simulated anomalies on real catalog objects
            </Typography>
          </Box>
        </Box>

        {/* Summary chips */}
        <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
          {(['critical', 'high', 'medium'] as const).map(sev => {
            const cnt = counts[sev] ?? 0
            if (!cnt) return null
            return (
              <Chip
                key={sev}
                label={`${cnt} ${sev.charAt(0).toUpperCase() + sev.slice(1)}`}
                size="small"
                sx={{
                  bgcolor: `${SEVERITY_COLOR[sev]}22`,
                  color: SEVERITY_COLOR[sev],
                  border: `1px solid ${SEVERITY_COLOR[sev]}55`,
                  fontWeight: 700,
                  fontSize: '0.7rem',
                  height: 22,
                }}
              />
            )
          })}
          {(counts['low'] ?? 0) > 0 && (
            <Chip
              label={`${counts['low']} Low`}
              size="small"
              sx={{
                bgcolor: `${SEVERITY_COLOR['low']}22`,
                color: SEVERITY_COLOR['low'],
                border: `1px solid ${SEVERITY_COLOR['low']}55`,
                fontWeight: 700,
                fontSize: '0.7rem',
                height: 22,
              }}
            />
          )}
        </Box>
      </Box>

      {/* Loading state */}
      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', pt: 6 }}>
          <CircularProgress size={36} sx={{ color: '#00b0ff' }} />
        </Box>
      ) : (
        <Paper
          elevation={0}
          sx={{
            bgcolor: BG_PAPER,
            border: `1px solid ${BORDER}`,
            borderRadius: 1,
            overflow: 'hidden',
          }}
        >
          <TableContainer>
            <Table size="small" sx={{ tableLayout: 'auto' }}>
              <TableHead>
                <TableRow>
                  <TableCell sx={{ ...headerCellSx, width: 32 }} />
                  <TableCell sx={headerCellSx}>Satellite</TableCell>
                  <TableCell sx={headerCellSx}>Anomaly Type</TableCell>
                  <TableCell sx={headerCellSx}>Severity</TableCell>
                  <TableCell sx={headerCellSx}>Parameter</TableCell>
                  <TableCell sx={headerCellSx}>Deviation (σ)</TableCell>
                  <TableCell sx={headerCellSx}>AI Score</TableCell>
                  <TableCell sx={headerCellSx}>Detected</TableCell>
                  <TableCell sx={headerCellSx}>Status</TableCell>
                  <TableCell sx={headerCellSx}>Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {events.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={10}
                      sx={{
                        textAlign: 'center',
                        color: 'rgba(255,255,255,0.3)',
                        py: 4,
                        borderBottom: 'none',
                        fontSize: '0.8rem',
                      }}
                    >
                      No anomaly events detected
                    </TableCell>
                  </TableRow>
                ) : (
                  events.map(event => (
                    <AnomalyRow key={event.id} event={event} onStatusChange={handleStatusChange} />
                  ))
                )}
              </TableBody>
            </Table>
          </TableContainer>
        </Paper>
      )}
    </Box>
  )
}

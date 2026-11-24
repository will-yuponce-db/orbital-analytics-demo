import React, { useEffect, useState, useMemo } from 'react'
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
  Stack,
  CircularProgress,
} from '@mui/material'
import * as satellite from 'satellite.js'
import { TelemetryData } from '../types'
import { fetchJson } from '../services/api'

interface MetricsPanelProps {
  satelliteName?: string
  noradId?: string
  telemetryData?: TelemetryData[]
  highlightedSensors?: string[]
  currentTime?: Date
  tle?: { line1: string; line2: string } | null
}

const EARTH_RADIUS = 6371 // km
const MU = 398600.4418 // Earth gravitational param km^3/s^2

const MetricsPanel: React.FC<MetricsPanelProps> = ({
  satelliteName = 'Primary Satellite',
  noradId,
  telemetryData: propData,
  highlightedSensors = [],
  currentTime,
  tle,
}) => {
  // Baseline metrics from the API, keyed by the NORAD ID they were fetched for.
  const [api, setApi] = useState<{ noradId: string; rows: TelemetryData[] } | null>(null)

  useEffect(() => {
    if (!noradId) return
    let cancelled = false
    fetchJson<TelemetryData[]>(`/api/metrics/${encodeURIComponent(noradId)}`)
      .then(data => (Array.isArray(data) ? data : []))
      .catch(() => [] as TelemetryData[])
      .then(rows => {
        if (!cancelled) setApi({ noradId, rows })
      })
    return () => {
      cancelled = true
    }
  }, [noradId])

  // Compute live metrics from SGP4 propagation when TLE + currentTime are available
  const liveMetrics = useMemo((): TelemetryData[] | null => {
    if (!tle?.line1 || !tle?.line2 || !currentTime) return null
    try {
      const satrec = satellite.twoline2satrec(tle.line1, tle.line2)
      const result = satellite.propagate(satrec, currentTime)
      if (
        !result ||
        !result.position ||
        typeof result.position === 'boolean' ||
        !result.velocity ||
        typeof result.velocity === 'boolean'
      )
        return null

      const pos = result.position
      const vel = result.velocity

      // Distance from Earth center
      const r = Math.sqrt(pos.x ** 2 + pos.y ** 2 + pos.z ** 2)
      const altitude = r - EARTH_RADIUS
      const velocity = Math.sqrt(vel.x ** 2 + vel.y ** 2 + vel.z ** 2)

      // Orbital elements from state vector
      const hx = pos.y * vel.z - pos.z * vel.y
      const hy = pos.z * vel.x - pos.x * vel.z
      const hz = pos.x * vel.y - pos.y * vel.x
      const h = Math.sqrt(hx ** 2 + hy ** 2 + hz ** 2)

      // Inclination
      const inclination = Math.acos(hz / h) * (180 / Math.PI)

      // RAAN
      const N = Math.sqrt((-hy) ** 2 + hx ** 2)
      let raan = 0
      if (N > 1e-10) {
        raan = Math.acos(-hy / N) * (180 / Math.PI)
        if (hx < 0) raan = 360 - raan
      }

      // Semi-major axis (vis-viva)
      const v2 = vel.x ** 2 + vel.y ** 2 + vel.z ** 2
      const sma = 1 / (2 / r - v2 / MU)

      // Eccentricity vector
      const rdotv = pos.x * vel.x + pos.y * vel.y + pos.z * vel.z
      const ex = (v2 / MU - 1 / r) * pos.x - (rdotv / MU) * vel.x
      const ey = (v2 / MU - 1 / r) * pos.y - (rdotv / MU) * vel.y
      const ez = (v2 / MU - 1 / r) * pos.z - (rdotv / MU) * vel.z
      const ecc = Math.sqrt(ex ** 2 + ey ** 2 + ez ** 2)

      // Mean motion (rev/day)
      const n_rad_s = Math.sqrt(MU / Math.abs(sma ** 3))
      const meanMotion = (n_rad_s * 86400) / (2 * Math.PI)

      // Orbital period
      const periodMin = (2 * Math.PI) / n_rad_s / 60

      return [
        {
          parameter: 'Altitude',
          value: altitude.toFixed(1),
          unit: 'km',
          status: altitude < 200 ? 'critical' : 'normal',
        },
        { parameter: 'Velocity', value: velocity.toFixed(3), unit: 'km/s', status: 'normal' },
        { parameter: 'Inclination', value: inclination.toFixed(2), unit: '°', status: 'normal' },
        {
          parameter: 'Eccentricity',
          value: ecc.toFixed(6),
          unit: '',
          status: ecc > 0.01 ? 'warning' : 'normal',
        },
        { parameter: 'RAAN', value: raan.toFixed(2), unit: '°', status: 'normal' },
        { parameter: 'Semi-Major Axis', value: sma.toFixed(1), unit: 'km', status: 'normal' },
        {
          parameter: 'Mean Motion',
          value: meanMotion.toFixed(4),
          unit: 'rev/day',
          status: 'normal',
        },
        { parameter: 'Period', value: periodMin.toFixed(1), unit: 'min', status: 'normal' },
      ]
    } catch {
      return null
    }
  }, [tle, currentTime])

  const apiData = api && api.noradId === noradId ? api.rows : []
  const loading = !!noradId && !liveMetrics && api?.noradId !== noradId
  const dataSource: 'live' | 'sgp4' | 'mock' = liveMetrics
    ? 'sgp4'
    : apiData.length > 0
      ? 'live'
      : 'mock'
  const displayData = liveMetrics || (apiData.length > 0 ? apiData : propData || [])

  const getStatusColor = (status: TelemetryData['status']) => {
    switch (status) {
      case 'normal':
        return 'success'
      case 'warning':
        return 'warning'
      case 'critical':
        return 'error'
      default:
        return 'default'
    }
  }

  const sourceLabel =
    dataSource === 'sgp4' ? 'SGP4' : dataSource === 'live' ? 'LAKEBASE' : 'NO DATA'

  return (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <Box sx={{ p: 2, borderBottom: 1, borderColor: 'divider' }}>
        <Stack direction="row" alignItems="center" spacing={1} mb={0.5}>
          <Typography variant="subtitle1" fontWeight={600}>
            Orbital Elements
          </Typography>
          {loading ? (
            <CircularProgress size={12} />
          ) : (
            <Chip
              label={sourceLabel}
              size="small"
              sx={{
                height: 16,
                fontSize: '0.6rem',
                fontWeight: 700,
                bgcolor: dataSource !== 'mock' ? 'rgba(0,230,118,0.15)' : 'rgba(255,255,255,0.08)',
                color: dataSource !== 'mock' ? '#00e676' : 'text.secondary',
              }}
            />
          )}
        </Stack>
        <Typography variant="caption" color="text.secondary">
          {satelliteName}
          {noradId ? ` · NORAD ${noradId}` : ''}
        </Typography>
        {currentTime && dataSource === 'sgp4' && (
          <Typography
            variant="caption"
            display="block"
            color="text.secondary"
            sx={{ mt: 0.25, fontSize: '0.65rem' }}
          >
            Propagated to {currentTime.toISOString().slice(0, 19)}Z
          </Typography>
        )}
      </Box>

      <TableContainer sx={{ flexGrow: 1, overflow: 'auto' }}>
        <Table size="small" stickyHeader>
          <TableHead>
            <TableRow>
              <TableCell>Parameter</TableCell>
              <TableCell align="right">Value</TableCell>
              <TableCell align="center">Status</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {displayData.map(row => {
              const isHighlighted = highlightedSensors.includes(row.parameter)
              return (
                <TableRow
                  key={row.parameter}
                  sx={{
                    '&:last-child td, &:last-child th': { border: 0 },
                    backgroundColor: isHighlighted ? 'action.hover' : 'transparent',
                    borderLeft: isHighlighted ? 3 : 0,
                    borderColor: isHighlighted ? 'primary.main' : 'transparent',
                  }}
                >
                  <TableCell component="th" scope="row">
                    <Typography variant="body2" fontWeight={isHighlighted ? 600 : 400}>
                      {row.parameter}
                    </Typography>
                  </TableCell>
                  <TableCell align="right">
                    <Typography variant="body2">
                      {row.value} {row.unit}
                    </Typography>
                  </TableCell>
                  <TableCell align="center">
                    <Chip
                      label={row.status}
                      size="small"
                      color={getStatusColor(row.status)}
                      sx={{ minWidth: 70, fontSize: '0.7rem' }}
                    />
                  </TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      </TableContainer>
    </Box>
  )
}

export default MetricsPanel

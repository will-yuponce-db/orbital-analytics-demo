import React from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Box,
  Card,
  CardActionArea,
  CardContent,
  Chip,
  Stack,
  Tooltip,
  Typography,
} from '@mui/material'
import { alpha } from '@mui/material/styles'
import {
  AccessTime as TimeIcon,
  Bolt as ManeuverIcon,
  History as PassedIcon,
  DoNotDisturbOn as WindowClosedIcon,
  TrendingUp as UpIcon,
  TrendingDown as DownIcon,
  TrendingFlat as FlatIcon,
} from '@mui/icons-material'
import useNow from '../hooks/useNow'
import {
  isUpcoming,
  maneuverWindow,
  pcTrend,
  showManeuver,
  type ConjunctionView,
  type ManeuverWindowState,
} from '../utils/conjunctions'
import { formatDuration, formatMissDistance, formatTcaCountdown, formatUtc } from '../utils/format'
import { PASSED_COLOR, TIER_COLOR } from '../utils/riskStyle'
import PcValue from './PcValue'
import PcSparkline from './PcSparkline'
import RiskTierChip from './RiskTierChip'

const TREND = {
  up: { Icon: UpIcon, color: '#ef9a9a', word: 'rising' },
  down: { Icon: DownIcon, color: '#a5d6a7', word: 'falling' },
  flat: { Icon: FlatIcon, color: '#b0bec5', word: 'steady' },
} as const

const chipSx = (color: string) => ({
  height: 22,
  fontWeight: 700,
  fontSize: '0.64rem',
  letterSpacing: 0.5,
  color,
  bgcolor: alpha(color, 0.14),
  border: `1px solid ${alpha(color, 0.4)}`,
  '& .MuiChip-icon': { color, fontSize: 14 },
})

function windowText(w: ManeuverWindowState, now: number): string {
  if (w.state === 'pending') return `Maneuver window opens in ${formatDuration(w.atMs - now)}`
  if (w.state === 'open')
    return `Maneuver window open, closes in ${formatDuration(w.untilMs - now)}`
  return `Maneuver window closed ${formatDuration(now - w.atMs)} ago`
}

const Metric: React.FC<{ label: string; hint: string; children: React.ReactNode }> = ({
  label,
  hint,
  children,
}) => (
  <Box sx={{ minWidth: 0 }}>
    <Tooltip title={hint} placement="top" disableInteractive>
      <Typography
        variant="caption"
        color="text.secondary"
        display="block"
        noWrap
        sx={{ cursor: 'help' }}
      >
        {label}
      </Typography>
    </Tooltip>
    {children}
  </Box>
)

interface ConjunctionCardProps {
  event: ConjunctionView
}

const ConjunctionCard: React.FC<ConjunctionCardProps> = ({ event }) => {
  const navigate = useNavigate()
  const now = useNow(1000)
  const passed = !isUpcoming(event, now)
  const color = passed ? PASSED_COLOR : TIER_COLOR[event.riskTier]
  const maneuver = showManeuver(event, now)
  const win = maneuver ? maneuverWindow(event, now) : null
  const windowClosed = win?.state === 'closed'
  const trend = pcTrend(event)
  const history = event.pcHistory.map(p => p.pc)
  const { satelliteA: a, satelliteB: b } = event
  const operators = [a.operator, b.operator].filter(Boolean).join(' / ')

  return (
    <Card
      sx={{
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        border: '1px solid',
        borderColor: alpha(color, passed ? 0.2 : 0.3),
        borderTop: `3px solid ${color}`,
        bgcolor: passed ? 'rgba(255,255,255,0.015)' : alpha(color, 0.05),
        opacity: passed ? 0.75 : 1,
        transition: 'box-shadow 0.2s, border-color 0.2s, opacity 0.2s',
        '&:hover': { boxShadow: `0 0 0 1px ${alpha(color, 0.6)}`, opacity: 1 },
      }}
    >
      <CardActionArea
        onClick={() => navigate(`/scenario/${encodeURIComponent(event.cdmId || event.id)}`)}
        sx={{ flexGrow: 1, display: 'flex', alignItems: 'stretch' }}
        aria-label={`Open conjunction ${a.name} and ${b.name}`}
      >
        <CardContent sx={{ width: '100%', pb: '14px !important' }}>
          {/* Tier and action state */}
          <Stack
            direction="row"
            justifyContent="space-between"
            alignItems="center"
            spacing={1}
            mb={1.25}
          >
            <RiskTierChip tier={event.riskTier} muted={passed} />
            {passed ? (
              <Chip size="small" icon={<PassedIcon />} label="PASSED" sx={chipSx(PASSED_COLOR)} />
            ) : maneuver && windowClosed ? (
              <Tooltip title="18 SDS Pc is above the maneuver threshold, but the planning window (TCA minus 48 h to TCA minus 6 h) has closed.">
                <Chip
                  size="small"
                  icon={<WindowClosedIcon />}
                  label="WINDOW CLOSED"
                  sx={chipSx(PASSED_COLOR)}
                />
              </Tooltip>
            ) : maneuver ? (
              <Tooltip
                title={`Maneuver recommended: 18 SDS Pc above 1×10⁻⁴. Planning window ${formatUtc(event.maneuverWindowOpen)} to ${formatUtc(event.maneuverWindowClose)}.`}
              >
                <Chip size="small" icon={<ManeuverIcon />} label="MANEUVER" sx={chipSx(color)} />
              </Tooltip>
            ) : null}
          </Stack>

          {/* Object pair */}
          <Typography variant="subtitle2" fontWeight={700} noWrap title={a.name}>
            {a.name}
          </Typography>
          <Typography variant="body2" color="text.secondary" noWrap title={b.name}>
            {'×'} {b.name}
          </Typography>
          <Typography variant="caption" color="text.disabled" display="block" noWrap>
            NORAD {a.noradId || 'n/a'} {'×'} {b.noradId || 'n/a'}
            {operators ? ` · ${operators}` : ''}
          </Typography>

          {/* Key figures */}
          <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', columnGap: 1, mt: 1.5 }}>
            <Metric
              label="Pc (18 SDS)"
              hint="Probability of collision reported in the CDM by the 18th Space Defense Squadron"
            >
              <PcValue
                pc={event.rawPc}
                variant="body2"
                fontWeight={700}
                sx={{ color: passed ? 'text.secondary' : color }}
              />
            </Metric>
            <Metric
              label="Pc (ML)"
              hint="OrbitWatch XGBoost estimate for the same event, shown for comparison"
            >
              <PcValue pc={event.mlPc} variant="body2" fontWeight={600} />
            </Metric>
            <Metric label="Miss distance" hint="Predicted minimum range at TCA">
              <Typography variant="body2" fontWeight={600} noWrap>
                {formatMissDistance(event.missDistanceM)}
              </Typography>
            </Metric>
          </Box>

          {/* CDM history */}
          <Stack direction="row" alignItems="center" spacing={1} mt={1.25} sx={{ minHeight: 24 }}>
            <PcSparkline values={history} color={passed ? PASSED_COLOR : color} />
            <Box sx={{ minWidth: 0 }}>
              <Typography variant="caption" color="text.secondary" display="block" noWrap>
                {event.cdmCount === 1 ? '1 CDM, no updates yet' : `${event.cdmCount} CDM updates`}
              </Typography>
              {trend && (
                <Stack
                  direction="row"
                  spacing={0.4}
                  alignItems="center"
                  aria-label={`Pc ${TREND[trend.direction].word}`}
                >
                  {React.createElement(TREND[trend.direction].Icon, {
                    sx: { fontSize: 14, color: TREND[trend.direction].color },
                  })}
                  <Typography variant="caption" sx={{ color: TREND[trend.direction].color }} noWrap>
                    <PcValue pc={trend.first} variant="caption" showOdds={false} /> {'→'}{' '}
                    <PcValue pc={trend.latest} variant="caption" showOdds={false} />
                  </Typography>
                </Stack>
              )}
            </Box>
          </Stack>

          {/* Maneuver window */}
          {maneuver && win && (
            <Typography
              variant="caption"
              display="block"
              mt={0.75}
              sx={{ color: windowClosed ? 'text.disabled' : alpha(color, 0.95) }}
              noWrap
            >
              {windowText(win, now)}
            </Typography>
          )}

          {/* TCA */}
          <Stack direction="row" spacing={0.5} alignItems="center" mt={1}>
            <TimeIcon sx={{ fontSize: 14, color: passed ? 'text.disabled' : 'text.secondary' }} />
            <Typography
              variant="caption"
              fontWeight={600}
              sx={{ fontVariantNumeric: 'tabular-nums' }}
              noWrap
            >
              {formatTcaCountdown(event.tcaMs, now)}
            </Typography>
            <Typography variant="caption" color="text.disabled" noWrap>
              {'·'} {formatUtc(event.tca)}
            </Typography>
          </Stack>
        </CardContent>
      </CardActionArea>
    </Card>
  )
}

export default ConjunctionCard

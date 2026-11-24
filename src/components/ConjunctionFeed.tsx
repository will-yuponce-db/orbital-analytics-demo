import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Box,
  Button,
  Chip,
  CircularProgress,
  Paper,
  Stack,
  ToggleButton,
  ToggleButtonGroup,
  Tooltip,
  Typography,
} from '@mui/material'
import { alpha } from '@mui/material/styles'
import { Bolt as ManeuverIcon } from '@mui/icons-material'
import useNow from '../hooks/useNow'
import useConjunctionEvents from '../hooks/useConjunctionEvents'
import {
  isRecentlyPassed,
  isUpcoming,
  maneuverWindow,
  showManeuver,
  type ConjunctionView,
} from '../utils/conjunctions'
import { formatMissDistance, formatTcaCountdown, formatUtc } from '../utils/format'
import { PASSED_COLOR, TIER_COLOR } from '../utils/riskStyle'
import { maneuverPrompt, openAssistant } from '../utils/assistant'
import PcValue from './PcValue'
import RiskTierChip from './RiskTierChip'

interface ConjunctionFeedProps {
  /** Limit the list to events involving these objects. */
  noradIds?: string[]
  /** CDM id of the event open in the detail view; that row is highlighted. */
  currentCdmId?: string
  /** Called after the assistant is asked to plan a maneuver. */
  onPlanManeuver?: (event: ConjunctionView) => void
}

const ConjunctionFeed: React.FC<ConjunctionFeedProps> = ({
  noradIds,
  currentCdmId,
  onPlanManeuver,
}) => {
  const navigate = useNavigate()
  const now = useNow(1000)
  const { events, loading, error } = useConjunctionEvents()
  const [sortBy, setSortBy] = useState<'pc' | 'tca'>('tca')
  const [scope, setScope] = useState<'upcoming' | 'all'>('upcoming')

  const ids = new Set(noradIds ?? [])
  const scoped = (events ?? []).filter(
    e => ids.size === 0 || ids.has(e.satelliteA.noradId) || ids.has(e.satelliteB.noradId)
  )
  const visible = scoped
    .filter(e =>
      scope === 'upcoming' ? isUpcoming(e, now) : isUpcoming(e, now) || isRecentlyPassed(e, now)
    )
    .sort((a, b) => (sortBy === 'pc' ? (b.rawPc ?? 0) - (a.rawPc ?? 0) : a.tcaMs - b.tcaMs))
  const upcoming = scoped.filter(e => isUpcoming(e, now))

  const plan = (e: ConjunctionView) => {
    openAssistant({ tab: 'chat', prompt: maneuverPrompt(e) })
    onPlanManeuver?.(e)
  }

  return (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <Box sx={{ p: 2, borderBottom: 1, borderColor: 'divider' }}>
        <Stack direction="row" alignItems="center" spacing={1} mb={0.5}>
          <Typography variant="subtitle1" fontWeight={600}>
            Conjunction events
          </Typography>
          {loading && !events ? (
            <CircularProgress size={12} />
          ) : (
            <Chip
              label={events ? 'LIVE' : 'NO DATA'}
              size="small"
              sx={{
                height: 16,
                fontSize: '0.6rem',
                fontWeight: 700,
                bgcolor: events ? 'rgba(0,230,118,0.15)' : 'rgba(255,255,255,0.08)',
                color: events ? '#00e676' : 'text.secondary',
              }}
            />
          )}
        </Stack>
        <Typography variant="caption" color="text.secondary" display="block">
          {error && !events
            ? 'Could not load events from Lakebase.'
            : `${upcoming.length} upcoming, one row per event. Select a row to open it.`}
        </Typography>
        <Stack direction="row" spacing={1} sx={{ mt: 1.25 }} flexWrap="wrap" useFlexGap>
          <ToggleButtonGroup
            value={sortBy}
            exclusive
            onChange={(_e: React.MouseEvent<HTMLElement>, v: 'pc' | 'tca' | null) =>
              v && setSortBy(v)
            }
            size="small"
          >
            <ToggleButton value="tca" sx={{ textTransform: 'none' }}>
              Soonest
            </ToggleButton>
            <ToggleButton value="pc" sx={{ textTransform: 'none' }}>
              Highest Pc
            </ToggleButton>
          </ToggleButtonGroup>
          <ToggleButtonGroup
            value={scope}
            exclusive
            onChange={(_e: React.MouseEvent<HTMLElement>, v: 'upcoming' | 'all' | null) =>
              v && setScope(v)
            }
            size="small"
          >
            <ToggleButton value="upcoming" sx={{ textTransform: 'none' }}>
              Upcoming
            </ToggleButton>
            <ToggleButton value="all" sx={{ textTransform: 'none' }}>
              With passed (24 h)
            </ToggleButton>
          </ToggleButtonGroup>
        </Stack>
      </Box>

      <Box sx={{ flexGrow: 1, overflow: 'auto' }}>
        {visible.length === 0 ? (
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              height: '100%',
              p: 4,
            }}
          >
            <Typography variant="body2" color="text.secondary" align="center">
              {loading && !events ? 'Loading events' : 'No upcoming conjunction events'}
            </Typography>
          </Box>
        ) : (
          visible.map(e => {
            const passed = !isUpcoming(e, now)
            const color = passed ? PASSED_COLOR : TIER_COLOR[e.riskTier]
            const current = !!currentCdmId && e.cdmIds.includes(currentCdmId)
            const win = showManeuver(e, now) ? maneuverWindow(e, now) : null
            const canPlan = win !== null && win.state !== 'closed'
            return (
              <Box
                key={e.eventKey}
                role="button"
                tabIndex={0}
                onClick={() => navigate(`/scenario/${encodeURIComponent(e.cdmId)}`)}
                onKeyDown={(ev: React.KeyboardEvent) => {
                  if (ev.key === 'Enter') navigate(`/scenario/${encodeURIComponent(e.cdmId)}`)
                }}
                aria-current={current ? 'true' : undefined}
                sx={{
                  px: 2,
                  py: 1.25,
                  cursor: 'pointer',
                  borderBottom: '1px solid',
                  borderColor: 'divider',
                  borderLeft: `3px solid ${current ? color : 'transparent'}`,
                  bgcolor: current ? alpha(color, 0.1) : 'transparent',
                  opacity: passed ? 0.65 : 1,
                  '&:hover': { bgcolor: alpha(color, current ? 0.14 : 0.06) },
                }}
              >
                <Stack
                  direction="row"
                  spacing={1}
                  alignItems="center"
                  justifyContent="space-between"
                >
                  <Stack direction="row" spacing={1} alignItems="center" sx={{ minWidth: 0 }}>
                    <RiskTierChip tier={e.riskTier} muted={passed} />
                    <Typography
                      variant="body2"
                      fontWeight={600}
                      noWrap
                      title={`${e.satelliteA.name} × ${e.satelliteB.name}`}
                    >
                      {e.satelliteA.name} {'×'} {e.satelliteB.name}
                    </Typography>
                  </Stack>
                  {current && (
                    <Chip
                      label="VIEWING"
                      size="small"
                      sx={{ height: 18, fontSize: '0.58rem', fontWeight: 700, flexShrink: 0 }}
                    />
                  )}
                </Stack>
                <Stack
                  direction="row"
                  spacing={1}
                  alignItems="center"
                  justifyContent="space-between"
                  mt={0.5}
                >
                  <Typography
                    variant="caption"
                    color="text.secondary"
                    component="div"
                    noWrap
                    sx={{ minWidth: 0 }}
                  >
                    Pc{' '}
                    <PcValue
                      pc={e.rawPc}
                      variant="caption"
                      fontWeight={700}
                      sx={{ color: passed ? 'text.secondary' : color }}
                    />
                    {' · ML '}
                    <PcValue pc={e.mlPc} variant="caption" />
                    {` · ${formatMissDistance(e.missDistanceM)} · ${e.cdmCount} CDM${e.cdmCount === 1 ? '' : 's'}`}
                  </Typography>
                  {canPlan && (
                    <Tooltip title="Ask the assistant to size an avoidance maneuver for this event">
                      <Button
                        size="small"
                        variant="outlined"
                        color="warning"
                        startIcon={<ManeuverIcon sx={{ fontSize: '14px !important' }} />}
                        onClick={(ev: React.MouseEvent) => {
                          ev.stopPropagation()
                          plan(e)
                        }}
                        sx={{
                          whiteSpace: 'nowrap',
                          fontSize: '0.68rem',
                          py: 0,
                          minWidth: 0,
                          flexShrink: 0,
                        }}
                      >
                        Plan
                      </Button>
                    </Tooltip>
                  )}
                </Stack>
                <Typography
                  variant="caption"
                  color="text.disabled"
                  display="block"
                  noWrap
                  sx={{ fontVariantNumeric: 'tabular-nums' }}
                >
                  {formatTcaCountdown(e.tcaMs, now)} {'·'} {formatUtc(e.tca)}
                  {win?.state === 'closed' ? ' · maneuver window closed' : ''}
                </Typography>
              </Box>
            )
          })
        )}
      </Box>

      {visible.length > 0 && (
        <Paper variant="outlined" sx={{ m: 1, p: 1, bgcolor: 'background.default' }}>
          <Typography variant="caption" color="text.secondary">
            {(['red', 'amber', 'green'] as const)
              .map(
                t => `${visible.filter(e => e.riskTier === t && isUpcoming(e, now)).length} ${t}`
              )
              .join(' · ')}
            {' · '}
            {visible.length} shown
          </Typography>
        </Paper>
      )}
    </Box>
  )
}

export default ConjunctionFeed

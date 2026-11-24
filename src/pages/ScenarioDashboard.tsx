import React, { useEffect, useMemo, useRef, useState } from 'react'
import { Link as RouterLink } from 'react-router-dom'
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Container,
  Divider,
  Grid,
  Link,
  Paper,
  Stack,
  Tab,
  Tabs,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Tooltip,
  Typography,
} from '@mui/material'
import { alpha } from '@mui/material/styles'
import {
  Search as SearchIcon,
  History as HistoryIcon,
  ExpandMore as ExpandMoreIcon,
  ReportOutlined as RedIcon,
  WarningAmberOutlined as AmberIcon,
  CheckCircleOutline as GreenIcon,
  Bolt as ManeuverIcon,
  TrackChanges as EventsIcon,
  ErrorOutline as AnomalyIcon,
  Science as SimulatedIcon,
} from '@mui/icons-material'
import ConjunctionCard from '../components/ConjunctionCard'
import AnomalyCard, { AnomalyEventRow } from '../components/AnomalyCard'
import useNow from '../hooks/useNow'
import useConjunctionEvents, { refreshConjunctionEvents } from '../hooks/useConjunctionEvents'
import {
  TIER_RULES,
  countEvents,
  isRecentlyPassed,
  isUpcoming,
  matchesSearch,
  type ConjunctionView,
  type RiskTier,
} from '../utils/conjunctions'
import { formatDuration, formatUtc } from '../utils/format'
import { PASSED_COLOR, SEVERITY_COLOR, TIER_COLOR, TIER_GROUP } from '../utils/riskStyle'
import { fetchJson } from '../services/api'
import { getRecentlyViewed, getRelativeTime } from '../utils/recentlyViewed'

const TIER_ICON: Record<RiskTier, typeof RedIcon> = {
  red: RedIcon,
  amber: AmberIcon,
  green: GreenIcon,
}
const TIERS: RiskTier[] = ['red', 'amber', 'green']

const ANOM_GROUPS: { severity: AnomalyEventRow['severity']; label: string }[] = [
  { severity: 'critical', label: 'Critical' },
  { severity: 'high', label: 'High' },
  { severity: 'medium', label: 'Medium' },
  { severity: 'low', label: 'Low' },
]

type SortKey = 'tca' | 'pc' | 'miss'

const SORTERS: Record<SortKey, (a: ConjunctionView, b: ConjunctionView) => number> = {
  tca: (a, b) => a.tcaMs - b.tcaMs,
  pc: (a, b) => (b.rawPc ?? 0) - (a.rawPc ?? 0),
  miss: (a, b) => (a.missDistanceM ?? Infinity) - (b.missDistanceM ?? Infinity),
}

interface KpiProps {
  value: number | string
  label: string
  hint: string
  color?: string
  icon?: React.ReactNode
}

const Kpi: React.FC<KpiProps> = ({ value, label, hint, color, icon }) => (
  <Tooltip title={hint} placement="bottom" disableInteractive>
    <Box sx={{ minWidth: 104, cursor: 'help' }}>
      <Stack direction="row" spacing={0.75} alignItems="center">
        {icon}
        <Typography
          variant="h4"
          fontWeight={600}
          sx={{ color, fontVariantNumeric: 'tabular-nums' }}
        >
          {value}
        </Typography>
      </Stack>
      <Typography variant="body2" color="text.secondary">
        {label}
      </Typography>
    </Box>
  </Tooltip>
)

const CardGrid: React.FC<{ events: ConjunctionView[] }> = ({ events }) => (
  <Grid container spacing={2}>
    {events.map(evt => (
      <Grid item xs={12} sm={6} md={4} lg={3} key={evt.eventKey}>
        <ConjunctionCard event={evt} />
      </Grid>
    ))}
  </Grid>
)

const ScenarioDashboard: React.FC = () => {
  const now = useNow(10_000)
  const { loading: conjLoading, error: conjError, events, loadedAt } = useConjunctionEvents()
  const [tab, setTab] = useState(0)
  const [searchTerm, setSearchTerm] = useState('')
  const [sortBy, setSortBy] = useState<SortKey>('tca')
  const [passedOpen, setPassedOpen] = useState(false)
  const searchInputRef = useRef<HTMLInputElement>(null)

  // Anomalies (simulated on real catalog objects)
  const [anomalies, setAnomalies] = useState<AnomalyEventRow[]>([])
  const [anomLoading, setAnomLoading] = useState(true)

  useEffect(() => {
    fetchJson<AnomalyEventRow[]>('/api/anomalies')
      .then(rows => {
        if (Array.isArray(rows)) setAnomalies(rows)
      })
      .catch(() => {})
      .finally(() => setAnomLoading(false))
  }, [])

  // Cmd/Ctrl+K focuses search
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault()
        searchInputRef.current?.focus()
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

  const recentlyViewed = getRecentlyViewed()
  const all = useMemo(() => events ?? [], [events])
  const counts = countEvents(all, now)
  // Unknown is not zero: show n/a until events have loaded.
  const kpi = (n: number) => (events ? n : conjLoading ? '…' : 'n/a')

  const filtered = all.filter(e => matchesSearch(e, searchTerm))
  const upcoming = filtered.filter(e => isUpcoming(e, now)).sort(SORTERS[sortBy])
  const passed = filtered.filter(e => isRecentlyPassed(e, now)).sort((a, b) => b.tcaMs - a.tcaMs)
  const next = all.filter(e => isUpcoming(e, now)).sort(SORTERS.tca)[0]

  const filteredAnom = anomalies.filter(a => {
    if (!searchTerm) return true
    const q = searchTerm.toLowerCase()
    return (
      (a.satellite_name ?? '').toLowerCase().includes(q) ||
      (a.anomaly_type ?? '').toLowerCase().includes(q)
    )
  })
  const anomCritHigh = anomalies.filter(
    a => a.severity === 'critical' || a.severity === 'high'
  ).length

  const loading = tab === 0 ? conjLoading && !events : anomLoading
  const live = !!events && !conjError

  return (
    <Container maxWidth="xl">
      <Box sx={{ my: 4 }}>
        {/* Header */}
        <Box sx={{ mb: 3 }}>
          <Stack
            direction="row"
            spacing={1.5}
            alignItems="center"
            mb={0.75}
            flexWrap="wrap"
            useFlexGap
          >
            <Typography variant="h4" component="h1" fontWeight={600}>
              Scenario Library
            </Typography>
            <Chip
              label={live ? 'LIVE · LAKEBASE' : conjError ? 'NO DATA' : 'LOADING'}
              size="small"
              sx={{
                bgcolor: live ? 'rgba(0,230,118,0.15)' : 'rgba(255,255,255,0.08)',
                color: live ? '#00e676' : 'text.secondary',
                fontWeight: 700,
                fontSize: '0.65rem',
              }}
            />
            {loadedAt && (
              <Typography variant="caption" color="text.secondary">
                Refreshed {formatUtc(loadedAt, { seconds: true })}
              </Typography>
            )}
          </Stack>
          <Typography variant="body1" color="text.secondary">
            Conjunctions from Space-Track CDMs, one card per event. Open a card for the 3D geometry,
            CDM history and the assistant.
          </Typography>
        </Box>

        {/* KPIs: upcoming events only, except the passed count */}
        <Paper elevation={2} sx={{ p: 3, mb: 3 }}>
          <Stack direction="row" spacing={4} flexWrap="wrap" useFlexGap alignItems="flex-start">
            <Kpi
              value={kpi(counts.upcoming)}
              label="Upcoming events"
              hint="Conjunction events with TCA still ahead"
              icon={<EventsIcon sx={{ color: 'text.secondary' }} />}
            />
            {TIERS.map(t => {
              const Icon = TIER_ICON[t]
              return (
                <Kpi
                  key={t}
                  value={kpi(counts[t])}
                  label={TIER_GROUP[t]}
                  hint={`Upcoming ${t} tier events: 18 SDS ${TIER_RULES[t]}`}
                  color={TIER_COLOR[t]}
                  icon={<Icon sx={{ color: TIER_COLOR[t] }} />}
                />
              )
            })}
            <Kpi
              value={kpi(counts.maneuverRecommended)}
              label="Maneuver advised"
              hint="Upcoming events above the 1×10⁻⁴ maneuver threshold"
              icon={<ManeuverIcon sx={{ color: 'text.secondary' }} />}
            />
            <Kpi
              value={next ? formatDuration(next.tcaMs - now) : 'n/a'}
              label="Next TCA"
              hint={
                next
                  ? `${next.satelliteA.name} × ${next.satelliteB.name} at ${formatUtc(next.tca, { seconds: true })}`
                  : 'No upcoming events'
              }
            />
            <Kpi
              value={kpi(counts.passed24h)}
              label="Passed (24 h)"
              hint="Events whose TCA passed in the last 24 hours"
              color={PASSED_COLOR}
              icon={<HistoryIcon sx={{ color: PASSED_COLOR }} />}
            />
            <Divider
              orientation="vertical"
              flexItem
              sx={{ mx: 1, display: { xs: 'none', md: 'block' } }}
            />
            <Kpi
              value={anomLoading ? '…' : anomCritHigh}
              label="Anomalies, critical or high"
              hint="Simulated anomalies on real catalog objects"
              color={SEVERITY_COLOR.critical}
              icon={<AnomalyIcon sx={{ color: SEVERITY_COLOR.critical }} />}
            />
          </Stack>
        </Paper>

        {/* Recently viewed */}
        {recentlyViewed.length > 0 && (
          <Paper elevation={1} sx={{ p: 2, mb: 3 }}>
            <Stack direction="row" spacing={1} alignItems="center" mb={1.5}>
              <HistoryIcon sx={{ color: 'text.secondary', fontSize: 20 }} />
              <Typography variant="subtitle2" fontWeight={600}>
                Recently viewed
              </Typography>
            </Stack>
            <Stack direction="row" spacing={1.5} flexWrap="wrap" useFlexGap>
              {recentlyViewed.map(item => (
                <Link
                  key={item.scenarioId}
                  component={RouterLink}
                  to={`/scenario/${item.scenarioId}`}
                  sx={{ textDecoration: 'none' }}
                >
                  <Chip
                    label={`${item.scenarioName} · ${getRelativeTime(item.timestamp)}`}
                    size="small"
                    variant="outlined"
                    sx={{
                      cursor: 'pointer',
                      '&:hover': { bgcolor: 'action.hover', borderColor: 'primary.main' },
                    }}
                  />
                </Link>
              ))}
            </Stack>
          </Paper>
        )}

        {/* Tabs, search, sort */}
        <Paper elevation={1} sx={{ mb: 3 }}>
          <Stack direction={{ xs: 'column', md: 'row' }} alignItems={{ md: 'center' }}>
            <Tabs
              value={tab}
              onChange={(_e: React.SyntheticEvent, v: number) => setTab(v)}
              sx={{
                borderBottom: { xs: 1, md: 0 },
                borderRight: { md: 1 },
                borderColor: 'divider',
                minHeight: 48,
                flexShrink: 0,
              }}
            >
              <Tab
                label={
                  <Stack direction="row" spacing={1} alignItems="center">
                    <span>Conjunctions</span>
                    <Chip
                      label={upcoming.length}
                      size="small"
                      sx={{ height: 18, fontSize: '0.7rem' }}
                    />
                  </Stack>
                }
                sx={{ minHeight: 48, textTransform: 'none' }}
              />
              <Tab
                label={
                  <Stack direction="row" spacing={1} alignItems="center">
                    <span>Anomalies</span>
                    <Chip
                      label={filteredAnom.length}
                      size="small"
                      sx={{ height: 18, fontSize: '0.7rem' }}
                    />
                    <Chip
                      label="SIMULATED"
                      size="small"
                      variant="outlined"
                      sx={{ height: 18, fontSize: '0.58rem', color: 'text.secondary' }}
                    />
                  </Stack>
                }
                sx={{ minHeight: 48, textTransform: 'none' }}
              />
            </Tabs>
            <Box sx={{ flexGrow: 1, px: 2, py: 1 }}>
              <TextField
                fullWidth
                size="small"
                placeholder={
                  tab === 0
                    ? 'Search object name, NORAD ID, operator or CDM ID (⌘K)'
                    : 'Search object name or anomaly type (⌘K)'
                }
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                inputRef={searchInputRef}
                InputProps={{
                  startAdornment: (
                    <SearchIcon sx={{ mr: 1, color: 'text.secondary', fontSize: 18 }} />
                  ),
                }}
              />
            </Box>
            {tab === 0 && (
              <Box sx={{ px: 2, py: 1 }}>
                <ToggleButtonGroup
                  size="small"
                  exclusive
                  value={sortBy}
                  onChange={(_e: React.MouseEvent<HTMLElement>, v: SortKey | null) =>
                    v && setSortBy(v)
                  }
                  aria-label="Sort events"
                >
                  <ToggleButton value="tca" sx={{ textTransform: 'none', px: 1.5 }}>
                    Soonest TCA
                  </ToggleButton>
                  <ToggleButton value="pc" sx={{ textTransform: 'none', px: 1.5 }}>
                    Highest Pc
                  </ToggleButton>
                  <ToggleButton value="miss" sx={{ textTransform: 'none', px: 1.5 }}>
                    Closest
                  </ToggleButton>
                </ToggleButtonGroup>
              </Box>
            )}
          </Stack>
        </Paper>

        {loading && (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
            <CircularProgress />
          </Box>
        )}

        {/* Conjunctions */}
        {!loading && tab === 0 && (
          <Box>
            {conjError && !events && (
              <Alert
                severity="error"
                sx={{ mb: 3 }}
                action={
                  <Button
                    color="inherit"
                    size="small"
                    onClick={() => void refreshConjunctionEvents()}
                  >
                    Retry
                  </Button>
                }
              >
                Could not load conjunctions from Lakebase. {conjError}
              </Alert>
            )}

            {TIERS.map(tier => {
              const items = upcoming.filter(c => c.riskTier === tier)
              if (items.length === 0) return null
              const Icon = TIER_ICON[tier]
              return (
                <Box key={tier} sx={{ mb: 4 }}>
                  <Stack direction="row" spacing={1.25} alignItems="center" mb={0.75}>
                    <Icon sx={{ color: TIER_COLOR[tier] }} />
                    <Typography variant="h6" fontWeight={700}>
                      {TIER_GROUP[tier]}
                    </Typography>
                    <Chip
                      label={items.length}
                      size="small"
                      sx={{
                        height: 20,
                        fontSize: '0.72rem',
                        bgcolor: alpha(TIER_COLOR[tier], 0.16),
                        color: TIER_COLOR[tier],
                        fontWeight: 700,
                      }}
                    />
                    <Typography variant="caption" color="text.secondary">
                      18 SDS {TIER_RULES[tier]}
                    </Typography>
                  </Stack>
                  <Divider sx={{ mb: 2 }} />
                  <CardGrid events={items} />
                </Box>
              )
            })}

            {events && upcoming.length === 0 && (
              <Paper sx={{ p: 5, mb: 4, textAlign: 'center' }}>
                <Typography color="text.secondary">
                  {searchTerm
                    ? 'No upcoming events match your search.'
                    : 'No upcoming conjunctions in the loaded CDMs.'}
                </Typography>
              </Paper>
            )}

            {passed.length > 0 && (
              <Accordion
                expanded={passedOpen}
                onChange={(_e: React.SyntheticEvent, open: boolean) => setPassedOpen(open)}
                disableGutters
                sx={{
                  bgcolor: 'rgba(255,255,255,0.02)',
                  border: '1px solid',
                  borderColor: 'divider',
                  '&:before': { display: 'none' },
                }}
              >
                <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                  <Stack direction="row" spacing={1.25} alignItems="center">
                    <HistoryIcon sx={{ color: PASSED_COLOR }} />
                    <Typography variant="subtitle1" fontWeight={700} color="text.secondary">
                      Recently passed (24 h)
                    </Typography>
                    <Chip
                      label={passed.length}
                      size="small"
                      sx={{ height: 20, fontSize: '0.72rem' }}
                    />
                    <Typography variant="caption" color="text.disabled">
                      TCA has passed. Shown for reference; no action applies.
                    </Typography>
                  </Stack>
                </AccordionSummary>
                <AccordionDetails sx={{ pt: 0, pb: 2 }}>
                  <CardGrid events={passed} />
                </AccordionDetails>
              </Accordion>
            )}
          </Box>
        )}

        {/* Anomalies */}
        {!loading && tab === 1 && (
          <Box>
            <Stack direction="row" spacing={1} alignItems="center" mb={2}>
              <SimulatedIcon sx={{ fontSize: 18, color: 'text.secondary' }} />
              <Typography variant="body2" color="text.secondary">
                Simulated anomalies on real catalog objects, included to show the triage workflow.
                Conjunction data on the other tab is live Space-Track data.
              </Typography>
            </Stack>
            {ANOM_GROUPS.map(group => {
              const items = filteredAnom.filter(a => a.severity === group.severity)
              if (items.length === 0) return null
              return (
                <Box key={group.severity} sx={{ mb: 4 }}>
                  <Stack direction="row" spacing={1.25} alignItems="center" mb={0.75}>
                    <AnomalyIcon sx={{ color: SEVERITY_COLOR[group.severity] }} />
                    <Typography variant="h6" fontWeight={700}>
                      {group.label}
                    </Typography>
                    <Chip
                      label={items.length}
                      size="small"
                      sx={{ height: 20, fontSize: '0.72rem' }}
                    />
                  </Stack>
                  <Divider sx={{ mb: 2 }} />
                  <Grid container spacing={2}>
                    {items.map(anom => (
                      <Grid item xs={12} sm={6} md={4} lg={3} key={anom.id}>
                        <AnomalyCard anomaly={anom} />
                      </Grid>
                    ))}
                  </Grid>
                </Box>
              )
            })}
            {filteredAnom.length === 0 && (
              <Paper sx={{ p: 6, textAlign: 'center' }}>
                <Typography color="text.secondary">
                  {searchTerm ? 'No anomalies match your search.' : 'No anomalies loaded.'}
                </Typography>
              </Paper>
            )}
          </Box>
        )}
      </Box>
    </Container>
  )
}

export default ScenarioDashboard

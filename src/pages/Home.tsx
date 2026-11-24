import React from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Alert,
  Box,
  Button,
  ButtonBase,
  Container,
  Grid,
  Paper,
  Skeleton,
  Stack,
  Tooltip,
  Typography,
} from '@mui/material'
import { alpha } from '@mui/material/styles'
import {
  ArrowForward as ArrowIcon,
  SmartToy as AssistantIcon,
  TrackChanges as EventsIcon,
  ReportOutlined as RedIcon,
  WarningAmberOutlined as AmberIcon,
  CheckCircleOutline as GreenIcon,
  SatelliteAlt as ObjectsIcon,
  Timer as TimerIcon,
  CallMerge as ClosestIcon,
  Bolt as ManeuverIcon,
  History as PassedIcon,
  ViewInAr as GeometryIcon,
  Insights as TriageIcon,
  QuestionAnswer as ChatIcon,
} from '@mui/icons-material'
import OrbitBackdrop from '../components/OrbitBackdrop'
import PipelineLineage from '../components/PipelineLineage'
import PcValue from '../components/PcValue'
import RiskTierChip from '../components/RiskTierChip'
import useNow from '../hooks/useNow'
import useOverview, { overviewHasData } from '../hooks/useOverview'
import useConjunctionEvents from '../hooks/useConjunctionEvents'
import { countEvents, headlineEvents } from '../utils/conjunctions'
import { formatAge, formatClock, formatInt, formatMissDistance, formatUtc } from '../utils/format'
import { PASSED_COLOR, TIER_COLOR, asTier } from '../utils/riskStyle'
import { openAssistant } from '../utils/assistant'
import type { OverviewEventRef } from '../services/api'

const tileSx = {
  p: 2,
  height: '100%',
  bgcolor: 'rgba(8, 14, 32, 0.62)',
  border: '1px solid rgba(255,255,255,0.09)',
  backdropFilter: 'blur(6px)',
} as const

interface StatTileProps {
  label: string
  value: React.ReactNode
  hint: string
  icon: React.ReactNode
  color?: string
  sub?: React.ReactNode
}

const StatTile: React.FC<StatTileProps> = ({ label, value, hint, icon, color, sub }) => (
  <Tooltip title={hint} disableInteractive>
    <Paper elevation={0} sx={{ ...tileSx, cursor: 'help' }}>
      <Stack
        direction="row"
        spacing={0.75}
        alignItems="center"
        sx={{ color: color ?? 'text.secondary', mb: 0.5, '& svg': { fontSize: 16 } }}
      >
        {icon}
        <Typography
          variant="caption"
          fontWeight={700}
          sx={{ letterSpacing: 0.6, textTransform: 'uppercase' }}
        >
          {label}
        </Typography>
      </Stack>
      <Typography
        variant="h4"
        fontWeight={700}
        sx={{ color, fontVariantNumeric: 'tabular-nums', lineHeight: 1.15 }}
      >
        {value}
      </Typography>
      {sub && (
        <Typography
          variant="caption"
          color="text.secondary"
          component="div"
          sx={{ mt: 0.25 }}
          noWrap
        >
          {sub}
        </Typography>
      )}
    </Paper>
  </Tooltip>
)

const EventTile: React.FC<{
  label: string
  icon: React.ReactNode
  event: OverviewEventRef | null
  loading: boolean
  headline: (e: OverviewEventRef) => React.ReactNode
  empty: string
}> = ({ label, icon, event, loading, headline, empty }) => {
  const navigate = useNavigate()
  const tier = asTier(event?.riskTier)
  const color = event ? TIER_COLOR[tier] : PASSED_COLOR
  const body = (
    <Paper
      elevation={0}
      sx={{ ...tileSx, width: '100%', textAlign: 'left', borderLeft: `3px solid ${color}` }}
    >
      <Stack direction="row" justifyContent="space-between" alignItems="center" mb={0.5}>
        <Stack
          direction="row"
          spacing={0.75}
          alignItems="center"
          sx={{ color: 'text.secondary', '& svg': { fontSize: 16 } }}
        >
          {icon}
          <Typography
            variant="caption"
            fontWeight={700}
            sx={{ letterSpacing: 0.6, textTransform: 'uppercase' }}
          >
            {label}
          </Typography>
        </Stack>
        {event?.riskTier && <RiskTierChip tier={tier} />}
      </Stack>
      {loading && !event ? (
        <Skeleton variant="text" width="60%" height={44} />
      ) : event ? (
        <>
          <Typography
            variant="h4"
            fontWeight={700}
            sx={{ fontVariantNumeric: 'tabular-nums', lineHeight: 1.15 }}
          >
            {headline(event)}
          </Typography>
          <Typography
            variant="body2"
            fontWeight={600}
            noWrap
            sx={{ mt: 0.5 }}
            title={`${event.satA} × ${event.satB}`}
          >
            {event.satA} {'×'} {event.satB}
          </Typography>
          <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 0.25 }}>
            TCA {formatUtc(event.tca, { seconds: true })}
          </Typography>
          <Stack direction="row" spacing={1.5} flexWrap="wrap" useFlexGap>
            <Typography variant="caption" color="text.secondary" component="span">
              Pc (18 SDS){' '}
              <PcValue
                pc={event.rawPc}
                variant="caption"
                fontWeight={700}
                sx={{ color: 'text.primary' }}
              />
            </Typography>
            <Typography variant="caption" color="text.secondary" component="span">
              Pc (ML){' '}
              <PcValue
                pc={event.mlPc}
                variant="caption"
                fontWeight={700}
                sx={{ color: 'text.primary' }}
              />
            </Typography>
          </Stack>
        </>
      ) : (
        <Typography variant="body2" color="text.secondary" sx={{ py: 1.5 }}>
          {empty}
        </Typography>
      )}
    </Paper>
  )
  if (!event) return body
  return (
    <ButtonBase
      onClick={() => navigate(`/scenario/${encodeURIComponent(event.id)}`)}
      sx={{
        display: 'block',
        width: '100%',
        height: '100%',
        borderRadius: 1,
        '&:hover .MuiPaper-root': { borderColor: alpha(color, 0.7) },
      }}
      aria-label={`Open ${label.toLowerCase()}: ${event.satA} and ${event.satB}`}
    >
      {body}
    </ButtonBase>
  )
}

const FEATURES = [
  {
    icon: <TriageIcon />,
    title: 'Triage by risk tier',
    text: 'Upcoming events grouped by the 18 SDS Pc, with countdowns to TCA, maneuver window status and the Pc trend across CDM updates.',
  },
  {
    icon: <GeometryIcon />,
    title: 'Inspect the geometry',
    text: 'SGP4 propagation of Space-Track GP element sets on a 3D globe, scrubbable through TCA, with orbital elements for each object.',
  },
  {
    icon: <ChatIcon />,
    title: 'Ask the assistant',
    text: 'Questions about live events, ML predictions or maneuver options, answered with tool calls against Lakebase. A person decides.',
  },
]

const Home: React.FC = () => {
  const navigate = useNavigate()
  const now = useNow(1000)
  const { data: overview, loading: ovLoading, source } = useOverview()
  const { events, loading: evLoading, error: evError } = useConjunctionEvents()

  // Event figures come from the grouped event list, the same source as the
  // scenario library, so both pages agree. The overview supplies the rest.
  const healthy = overviewHasData(overview)
  const counts = events ? countEvents(events, now) : healthy ? overview.events : null
  const headline = events ? headlineEvents(events, now) : healthy ? overview : null
  const nextTca = headline?.nextTca ?? null
  const closest = headline?.closestApproach ?? null
  const loadingEvents = evLoading && !events && ovLoading
  const n = (v: number | undefined | null) =>
    v == null ? (loadingEvents ? '…' : 'n/a') : formatInt(v)
  const asOfMs = overview?.dataAsOf ? Date.parse(overview.dataAsOf) : NaN

  return (
    <Container maxWidth="xl">
      <Box sx={{ my: { xs: 3, md: 4 } }}>
        {/* Hero: live mission overview */}
        <Paper
          elevation={0}
          sx={{
            position: 'relative',
            overflow: 'hidden',
            p: { xs: 3, md: 4.5 },
            mb: 3,
            border: '1px solid rgba(100,181,246,0.18)',
            background: 'linear-gradient(135deg, #0f2140 0%, #13294d 45%, #0b1730 100%)',
          }}
        >
          <OrbitBackdrop />
          {evError && !events && !healthy && (
            <Alert
              severity="error"
              variant="outlined"
              sx={{ position: 'relative', mb: 3, bgcolor: 'rgba(10,14,39,0.6)' }}
            >
              Live data is unavailable: the app could not read conjunctions from Lakebase. Figures
              below are not current.
            </Alert>
          )}
          <Grid container spacing={{ xs: 3, md: 4 }} sx={{ position: 'relative' }}>
            <Grid item xs={12} md={5}>
              <Stack spacing={2.25} sx={{ height: '100%' }}>
                <Stack direction="row" spacing={1} alignItems="center">
                  <Box
                    sx={{
                      width: 8,
                      height: 8,
                      borderRadius: '50%',
                      bgcolor: '#00e676',
                      boxShadow: '0 0 0 0 rgba(0,230,118,0.6)',
                      animation: 'owPulse 2.4s infinite',
                      '@keyframes owPulse': {
                        '0%': { boxShadow: '0 0 0 0 rgba(0,230,118,0.55)' },
                        '70%': { boxShadow: '0 0 0 8px rgba(0,230,118,0)' },
                        '100%': { boxShadow: '0 0 0 0 rgba(0,230,118,0)' },
                      },
                      '@media (prefers-reduced-motion: reduce)': { animation: 'none' },
                    }}
                  />
                  <Typography
                    variant="overline"
                    sx={{ letterSpacing: 2, color: 'primary.light', lineHeight: 1 }}
                  >
                    Live mission overview
                  </Typography>
                </Stack>
                <Typography variant="h3" component="h1" fontWeight={700} sx={{ lineHeight: 1.1 }}>
                  Conjunction assessment
                </Typography>
                <Typography variant="body1" sx={{ color: 'rgba(255,255,255,0.78)', maxWidth: 520 }}>
                  Upcoming close approaches from Space-Track CDMs. Every event carries the 18 SDS
                  probability of collision, an XGBoost estimate for comparison, the miss distance
                  and its CDM history.
                </Typography>
                <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5}>
                  <Button
                    variant="contained"
                    size="large"
                    endIcon={<ArrowIcon />}
                    onClick={() => navigate('/scenarios')}
                    sx={{
                      px: 3,
                      fontWeight: 700,
                      bgcolor: 'white',
                      color: '#0d2a52',
                      '&:hover': { bgcolor: 'rgba(255,255,255,0.88)' },
                    }}
                  >
                    Open scenario library
                  </Button>
                  <Button
                    variant="outlined"
                    size="large"
                    startIcon={<AssistantIcon />}
                    onClick={() => openAssistant({ tab: 'chat' })}
                    sx={{
                      px: 2.5,
                      color: 'white',
                      borderColor: 'rgba(255,255,255,0.4)',
                      '&:hover': { borderColor: 'white' },
                    }}
                  >
                    Ask the assistant
                  </Button>
                </Stack>
                <Box sx={{ flexGrow: 1 }} />
                <Box
                  component="dl"
                  sx={{
                    m: 0,
                    display: 'grid',
                    gridTemplateColumns: 'auto 1fr',
                    columnGap: 1.5,
                    rowGap: 0.5,
                    maxWidth: 520,
                    '& dt': {
                      display: 'flex',
                      alignItems: 'center',
                      gap: 0.5,
                      fontSize: '0.75rem',
                      fontWeight: 700,
                    },
                    '& dd': { m: 0, fontSize: '0.75rem', color: 'rgba(255,255,255,0.7)' },
                  }}
                >
                  <dt style={{ color: TIER_COLOR.red }}>
                    <RedIcon sx={{ fontSize: 14 }} /> Red
                  </dt>
                  <dd>18 SDS Pc above 1×10⁻³. Action required.</dd>
                  <dt style={{ color: TIER_COLOR.amber }}>
                    <AmberIcon sx={{ fontSize: 14 }} /> Amber
                  </dt>
                  <dd>1×10⁻⁴ to 1×10⁻³. Monitor and prepare.</dd>
                  <dt style={{ color: TIER_COLOR.green }}>
                    <GreenIcon sx={{ fontSize: 14 }} /> Green
                  </dt>
                  <dd>Below 1×10⁻⁴. Routine screening.</dd>
                  <dt style={{ color: 'rgba(255,255,255,0.8)' }}>
                    <ManeuverIcon sx={{ fontSize: 14 }} /> Maneuver
                  </dt>
                  <dd>Advised above 1×10⁻⁴, planned between TCA minus 48 h and TCA minus 6 h.</dd>
                </Box>
                <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.6)' }}>
                  {Number.isNaN(asOfMs)
                    ? source === 'derived'
                      ? 'Overview endpoint unavailable; figures derived from the event list.'
                      : ovLoading
                        ? 'Checking data freshness…'
                        : 'Data timestamp unavailable.'
                    : `Data as of ${formatUtc(asOfMs, { seconds: true })} (${formatAge(now - asOfMs)}), newest CDM.`}
                  {overview?.lastLoadedAt
                    ? ` Loaded into Lakebase ${formatUtc(overview.lastLoadedAt)}.`
                    : ''}{' '}
                  All times UTC.
                </Typography>
              </Stack>
            </Grid>

            <Grid item xs={12} md={7}>
              <Grid container spacing={1.5}>
                <Grid item xs={6} sm={3}>
                  <StatTile
                    label="Upcoming"
                    value={n(counts?.upcoming)}
                    hint="Conjunction events with TCA still ahead"
                    icon={<EventsIcon />}
                    sub="events"
                  />
                </Grid>
                <Grid item xs={6} sm={3}>
                  <StatTile
                    label="Red"
                    value={n(counts?.red)}
                    hint="Upcoming events with 18 SDS Pc above 1×10⁻³"
                    icon={<RedIcon />}
                    color={TIER_COLOR.red}
                    sub="action required"
                  />
                </Grid>
                <Grid item xs={6} sm={3}>
                  <StatTile
                    label="Amber"
                    value={n(counts?.amber)}
                    hint="Upcoming events with 18 SDS Pc between 1×10⁻⁴ and 1×10⁻³"
                    icon={<AmberIcon />}
                    color={TIER_COLOR.amber}
                    sub="monitoring"
                  />
                </Grid>
                <Grid item xs={6} sm={3}>
                  <StatTile
                    label="Objects"
                    value={
                      healthy && overview.objectsTracked != null
                        ? formatInt(overview.objectsTracked)
                        : ovLoading
                          ? '…'
                          : 'n/a'
                    }
                    hint="Catalog objects with Space-Track records loaded into Lakebase"
                    icon={<ObjectsIcon />}
                    sub="tracked"
                  />
                </Grid>

                <Grid item xs={12} sm={6}>
                  <EventTile
                    label="Next TCA"
                    icon={<TimerIcon />}
                    event={nextTca}
                    loading={loadingEvents}
                    empty="No upcoming conjunctions in the loaded CDMs."
                    headline={e => (
                      <Box
                        component="span"
                        sx={{ fontFamily: '"Roboto Mono", ui-monospace, monospace' }}
                      >
                        {formatClock(Date.parse(e.tca) - now)}
                      </Box>
                    )}
                  />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <EventTile
                    label="Closest approach"
                    icon={<ClosestIcon />}
                    event={closest}
                    loading={loadingEvents}
                    empty="No miss distances reported for upcoming events."
                    headline={e => formatMissDistance(e.missDistanceM)}
                  />
                </Grid>

                <Grid item xs={12}>
                  <Paper elevation={0} sx={{ ...tileSx, py: 1.25 }}>
                    <Stack
                      direction="row"
                      spacing={3}
                      flexWrap="wrap"
                      useFlexGap
                      alignItems="center"
                    >
                      <Stack direction="row" spacing={0.75} alignItems="center">
                        <ManeuverIcon sx={{ fontSize: 16, color: 'text.secondary' }} />
                        <Typography variant="body2" color="text.secondary">
                          Maneuver advised{' '}
                          <b style={{ color: '#fff' }}>{n(counts?.maneuverRecommended)}</b>
                        </Typography>
                      </Stack>
                      <Stack direction="row" spacing={0.75} alignItems="center">
                        <PassedIcon sx={{ fontSize: 16, color: PASSED_COLOR }} />
                        <Typography variant="body2" color="text.secondary">
                          Passed in last 24 h{' '}
                          <b style={{ color: '#fff' }}>{n(counts?.passed24h)}</b>
                        </Typography>
                      </Stack>
                      {headline?.highestPc && (
                        <Typography
                          variant="body2"
                          color="text.secondary"
                          noWrap
                          sx={{ minWidth: 0 }}
                        >
                          Highest Pc (18 SDS){' '}
                          <PcValue
                            pc={headline.highestPc.rawPc}
                            variant="body2"
                            fontWeight={700}
                            sx={{ color: '#fff' }}
                          />{' '}
                          {headline.highestPc.satA} {'×'} {headline.highestPc.satB}
                        </Typography>
                      )}
                    </Stack>
                  </Paper>
                </Grid>
              </Grid>
            </Grid>
          </Grid>
        </Paper>

        {/* Lineage */}
        <Box sx={{ mb: 3 }}>
          <PipelineLineage overview={overview} />
        </Box>

        {/* What the app does */}
        <Grid container spacing={2}>
          {FEATURES.map(f => (
            <Grid item xs={12} md={4} key={f.title}>
              <Paper
                elevation={1}
                sx={{ p: 2.5, height: '100%', border: '1px solid rgba(255,255,255,0.08)' }}
              >
                <Stack
                  direction="row"
                  spacing={1.25}
                  alignItems="center"
                  mb={1}
                  sx={{ color: 'primary.light' }}
                >
                  {f.icon}
                  <Typography variant="subtitle1" fontWeight={700} color="text.primary">
                    {f.title}
                  </Typography>
                </Stack>
                <Typography variant="body2" color="text.secondary">
                  {f.text}
                </Typography>
              </Paper>
            </Grid>
          ))}
        </Grid>

        <Box sx={{ mt: 4, textAlign: 'center' }}>
          <Typography variant="caption" color="text.secondary">
            OrbitWatch on Databricks. Conjunction and element data: Space-Track.org public CDM and
            GP feeds.
          </Typography>
        </Box>
      </Box>
    </Container>
  )
}

export default Home

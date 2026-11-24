import React, { useState, useCallback, useEffect, useMemo } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  Box,
  Paper,
  Typography,
  IconButton,
  Stack,
  Chip,
  Tabs,
  Tab,
  Button,
  Tooltip,
  useMediaQuery,
  Drawer,
  Snackbar,
  Alert,
  Breadcrumbs,
  Link,
  CircularProgress,
  Divider,
} from '@mui/material'
import {
  ArrowBack as BackIcon,
  FileDownload as ExportIcon,
  Link as ShareIcon,
  SatelliteAlt as SatelliteIcon,
  SmartToy as AIIcon,
  Menu as MenuIcon,
  Dashboard as MetricsIcon,
  TrackChanges as ConjunctionIcon,
  ErrorOutline as AnomalyIcon,
  Timeline as TimelineIcon,
  Psychology as MLIcon,
  AccessTime as TimeIcon,
} from '@mui/icons-material'
import { addToRecentlyViewed } from '../utils/recentlyViewed'
import type { Scenario } from '../types'
import SatelliteList from '../components/SatelliteList'
import MetricsPanel from '../components/MetricsPanel'
import AITwinPanel from '../components/AITwinPanel'
import ConjunctionFeed from '../components/ConjunctionFeed'
import AnomalyPanel from '../components/AnomalyPanel'
import TimelinePanel from '../components/TimelinePanel'
import MLInsightsPanel from '../components/MLInsightsPanel'
import Visualization3D from '../components/Visualization3D'
import TimelineControl, { TimelineMarker } from '../components/TimelineControl'
import PcValue from '../components/PcValue'
import PcSparkline from '../components/PcSparkline'
import RiskTierChip from '../components/RiskTierChip'
import { useTheme as useMuiTheme } from '@mui/material/styles'
import { Satellite } from '../types'
import useNow from '../hooks/useNow'
import { fetchJson } from '../services/api'
import {
  isUpcoming,
  maneuverWindow,
  normalizeAndGroup,
  normalizeConjunction,
  showManeuver,
  type ConjunctionView,
} from '../utils/conjunctions'
import {
  formatDuration,
  formatMissDistance,
  formatPcPlain,
  formatTcaCountdown,
  formatUtc,
} from '../utils/format'
import { PASSED_COLOR, TIER_COLOR } from '../utils/riskStyle'
import { analysisPrompt, maneuverPrompt, openAssistant } from '../utils/assistant'

interface ConjunctionWarning {
  satelliteANoradId: string
  satelliteBNoradId: string
  tca: string
  riskTier: string
  missDistanceKm: number
}

/** Ticks on its own so the 3D view does not re-render every second. */
const TcaCountdown: React.FC<{ tcaMs: number }> = ({ tcaMs }) => {
  const now = useNow(1000)
  return <>{formatTcaCountdown(tcaMs, now)}</>
}

const Fact: React.FC<{ label: string; children: React.ReactNode; hint?: string }> = ({
  label,
  children,
  hint,
}) => (
  <Tooltip title={hint ?? ''} disableHoverListener={!hint} disableInteractive>
    <Box sx={{ minWidth: 0 }}>
      <Typography
        variant="caption"
        color="text.secondary"
        display="block"
        noWrap
        sx={{ lineHeight: 1.2 }}
      >
        {label}
      </Typography>
      <Typography
        variant="body2"
        fontWeight={700}
        component="div"
        noWrap
        sx={{ fontVariantNumeric: 'tabular-nums' }}
      >
        {children}
      </Typography>
    </Box>
  </Tooltip>
)

function downloadJson(filename: string, data: unknown) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

const ScenarioDetailView: React.FC = () => {
  const { scenarioId } = useParams<{ scenarioId: string }>()
  const navigate = useNavigate()
  const theme = useMuiTheme()
  const isMobile = useMediaQuery(theme.breakpoints.down('md'))
  const [rightTabValue, setRightTabValue] = useState(0)
  const [leftDrawerOpen, setLeftDrawerOpen] = useState(false)
  const [rightDrawerOpen, setRightDrawerOpen] = useState(false)
  const [snackbar, setSnackbar] = useState<{
    message: string
    severity: 'success' | 'info' | 'error'
  } | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  const [scenario, setScenario] = useState<Scenario | null>(null)
  /** The conjunction this view is about, with CDM history when available. */
  const [event, setEvent] = useState<ConjunctionView | null>(null)
  const [currentTime, setCurrentTime] = useState<Date>(new Date())
  const [satellites, setSatellites] = useState<Scenario['satellites']>([])
  const [timelineMarkers, setTimelineMarkers] = useState<TimelineMarker[]>([])
  const [conjunctionWarnings, setConjunctionWarnings] = useState<ConjunctionWarning[]>([])

  const noradIds = useMemo(() => satellites.map(s => s.noradId).filter(Boolean), [satellites])
  const pairNoradIds = useMemo(
    () => (event ? [event.satelliteA.noradId, event.satelliteB.noradId].filter(Boolean) : []),
    [event]
  )
  const primary = useMemo(
    () =>
      satellites.find(s => s.noradId === event?.satelliteA.noradId) ??
      satellites.find(s => s.selected) ??
      satellites[0],
    [satellites, event]
  )

  // Load the event, all satellites with TLEs, and every conjunction for the timeline.
  useEffect(() => {
    if (!scenarioId) return

    Promise.all([
      fetchJson<Record<string, unknown>>(
        `/api/conjunctions/${encodeURIComponent(scenarioId)}`
      ).catch(() => null),
      fetchJson<Record<string, unknown>[]>('/api/satellites').catch(() => []),
      fetchJson<Record<string, unknown>[]>('/api/satellites/tle').catch(() => []),
      fetchJson<unknown[]>('/api/conjunctions?status=all&limit=250').catch(() => []),
    ])
      .then(([conjRow, allSats, allTles, allConjs]) => {
        if (!conjRow) return

        const row = conjRow
        const satA = row.satelliteA as Record<string, unknown> | undefined
        const satB = row.satelliteB as Record<string, unknown> | undefined

        // TLE lookup by NORAD ID: the pair's own TLEs first, then the bulk set.
        const tleLookup: Record<string, { line1: string; line2: string }> = {}
        if (satA?.tle)
          tleLookup[satA.noradId as string] = satA.tle as { line1: string; line2: string }
        if (satB?.tle)
          tleLookup[satB.noradId as string] = satB.tle as { line1: string; line2: string }
        if (Array.isArray(allTles)) {
          for (const t of allTles) {
            const noradId = t?.noradId as string | undefined
            if (noradId && t?.line1 && t?.line2 && !tleLookup[noradId]) {
              tleLookup[noradId] = { line1: t.line1 as string, line2: t.line2 as string }
            }
          }
        }

        const primaryNoradA = (satA?.noradId as string) ?? ''
        const primaryNoradB = (satB?.noradId as string) ?? ''
        const categoryMap: Record<string, 'active' | 'debris' | 'rocket-body'> = {
          active: 'active',
          debris: 'debris',
          'rocket-body': 'rocket-body',
        }
        const fullSatellites: Satellite[] = (Array.isArray(allSats) ? allSats : []).map(s => ({
          id: String(s.id),
          name: s.name as string,
          noradId: s.noradId as string,
          category: categoryMap[s.category as string] ?? 'active',
          altitude: Number(s.altitude ?? 550),
          velocity: Number(s.velocity ?? 7.6),
          selected: s.noradId === primaryNoradA || s.noradId === primaryNoradB,
          orbitalParams: (s.orbitalParams as Satellite['orbitalParams']) ?? {
            semiMajorAxis: 6921,
            eccentricity: 0.001,
            inclination: 53,
            raan: 0,
            argOfPerigee: 0,
            trueAnomaly: 0,
          },
          tle: tleLookup[s.noradId as string] ?? null,
        }))

        // One entry per physical event for markers and 3D warning lines.
        const grouped = normalizeAndGroup(Array.isArray(allConjs) ? allConjs : [])
        const own = normalizeConjunction(row)
        const match = own ? grouped.find(g => g.cdmIds.includes(own.cdmId)) : undefined
        const view: ConjunctionView | null = own
          ? match &&
            match.cdmCount >= own.cdmCount &&
            match.pcHistory.length >= own.pcHistory.length
            ? {
                ...own,
                cdmCount: match.cdmCount,
                firstPc: match.firstPc ?? own.firstPc,
                pcHistory: match.pcHistory,
                cdmIds: match.cdmIds,
              }
            : own
          : null

        const tcaTimes = grouped.map(g => g.tcaMs)
        const earliestTca = tcaTimes.length > 0 ? Math.min(...tcaTimes) : Date.now()
        const latestTca = tcaTimes.length > 0 ? Math.max(...tcaTimes) : Date.now()
        const timelineStart = new Date(earliestTca - 24 * 3600000).toISOString()
        const timelineEnd = new Date(latestTca + 12 * 3600000).toISOString()

        const name = `${satA?.name ?? 'Unknown'} × ${satB?.name ?? 'Unknown'}`
        const built: Scenario = {
          id: scenarioId,
          name,
          description: `CDM ${row.cdmId || scenarioId}`,
          dataQuality: 'operational',
          createdAt: new Date().toISOString(),
          startTime: timelineStart,
          endTime: timelineEnd,
          duration: Math.round((latestTca - earliestTca + 36 * 3600000) / 60000),
          satelliteCount: fullSatellites.length,
          aiDecisionStatus:
            row.riskTier === 'red' ? 'critical' : row.riskTier === 'amber' ? 'warning' : 'nominal',
          tags: [row.riskTier as string, 'conjunction'],
          satellites: fullSatellites,
          events: [],
          aiRecommendations: [],
          telemetryData: [],
        }
        setScenario(built)
        setEvent(view)
        setSatellites(fullSatellites)
        setCurrentTime(new Date(row.tca as string))
        addToRecentlyViewed(scenarioId, name)

        setTimelineMarkers(
          grouped.map(g => ({
            time: g.tca,
            label: `${g.satelliteA.name} × ${g.satelliteB.name} (Pc ${formatPcPlain(g.rawPc)}, ${formatMissDistance(g.missDistanceM)})`,
            color: TIER_COLOR[g.riskTier],
            type: 'conjunction' as const,
          }))
        )
        setConjunctionWarnings(
          grouped.map(g => ({
            satelliteANoradId: g.satelliteA.noradId,
            satelliteBNoradId: g.satelliteB.noradId,
            tca: g.tca,
            riskTier: g.riskTier,
            missDistanceKm: (g.missDistanceM ?? 0) / 1000,
          }))
        )
      })
      .catch(() => {
        // Leave the not-found state in place.
      })
      .finally(() => setIsLoading(false))
  }, [scenarioId])

  // Simulated anomalies on these objects, as extra timeline markers.
  useEffect(() => {
    if (noradIds.length === 0) return
    const severityColor: Record<string, string> = {
      critical: '#ff1744',
      high: '#ff6d00',
      medium: '#ffab00',
      low: '#00b0ff',
    }
    fetchJson<Record<string, unknown>[]>(`/api/anomalies?norad_ids=${noradIds.join(',')}`)
      .then(anomalies => {
        if (!Array.isArray(anomalies)) return
        const anomalyMarkers: TimelineMarker[] = anomalies
          .map(a => ({
            time: (a.detected_at ?? a.detectedAt) as string,
            label: `${a.satellite_name ?? a.satelliteName ?? 'Unknown'}: ${a.anomaly_type ?? a.anomalyType ?? 'anomaly'} (simulated)`,
            color: severityColor[a.severity as string] ?? '#ffab00',
            type: 'anomaly' as const,
          }))
          .filter(m => m.time)
        setTimelineMarkers(prev => [...prev.filter(m => m.type !== 'anomaly'), ...anomalyMarkers])
      })
      .catch(() => {})
  }, [noradIds])

  const handleTimeChange = useCallback((newTime: Date) => {
    setCurrentTime(newTime)
  }, [])

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setLeftDrawerOpen(false)
        setRightDrawerOpen(false)
        return
      }
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return
      if (e.ctrlKey || e.metaKey || e.altKey) return
      const tabs: Record<string, number> = { m: 0, a: 1, c: 2, x: 3, t: 4, l: -1 }
      const key = e.key.toLowerCase()
      if (!(key in tabs)) return
      if (key === 'l') {
        if (isMobile) setLeftDrawerOpen(open => !open)
        return
      }
      setRightTabValue(tabs[key])
      if (isMobile) setRightDrawerOpen(true)
    }
    window.addEventListener('keydown', handleKeyPress)
    return () => window.removeEventListener('keydown', handleKeyPress)
  }, [isMobile])

  if (isLoading) {
    return (
      <Box
        sx={{
          display: 'flex',
          flexDirection: 'column',
          gap: 2,
          justifyContent: 'center',
          alignItems: 'center',
          minHeight: '50vh',
        }}
      >
        <CircularProgress />
        <Typography variant="body2" color="text.secondary">
          Loading the event, element sets and conjunction history
        </Typography>
      </Box>
    )
  }

  if (!scenario) {
    return (
      <Box sx={{ p: 4, textAlign: 'center' }}>
        <Typography variant="h5">Event not found</Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
          CDM {scenarioId} is not in the current data. It may have aged out after a reload.
        </Typography>
        <Button onClick={() => navigate('/scenarios')} sx={{ mt: 2 }}>
          Back to the scenario library
        </Button>
      </Box>
    )
  }

  const handleToggleSatellite = (satelliteId: string) => {
    setSatellites(prev =>
      prev.map(sat => (sat.id === satelliteId ? { ...sat, selected: !sat.selected } : sat))
    )
  }

  const handleSatelliteClick = (satellite: Satellite) => {
    handleToggleSatellite(satellite.id)
  }

  const handleExport = () => {
    if (!event) return
    downloadJson(`orbitwatch-cdm-${event.cdmId}.json`, {
      exportedAt: new Date().toISOString(),
      source: 'OrbitWatch (Space-Track CDM via Lakebase)',
      event: {
        cdmId: event.cdmId,
        cdmIds: event.cdmIds,
        tca: event.tca,
        missDistanceM: event.missDistanceM,
        pc18Sds: event.rawPc,
        pcMl: event.mlPc,
        riskTier: event.riskTier,
        maneuverRecommended: event.maneuverRecommended,
        maneuverWindowOpen: event.maneuverWindowOpen,
        maneuverWindowClose: event.maneuverWindowClose,
        cdmCount: event.cdmCount,
        pcHistory: event.pcHistory,
        objects: [event.satelliteA, event.satelliteB],
      },
    })
    setSnackbar({ message: `Exported CDM ${event.cdmId} as JSON`, severity: 'success' })
  }

  const handleShare = () => {
    const url = window.location.href
    if (navigator.clipboard?.writeText) {
      navigator.clipboard
        .writeText(url)
        .then(() => setSnackbar({ message: 'Link copied to clipboard', severity: 'success' }))
        .catch(() => setSnackbar({ message: url, severity: 'info' }))
    } else {
      setSnackbar({ message: url, severity: 'info' })
    }
  }

  const leftSidebar = (
    <Paper
      elevation={2}
      sx={{ height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}
    >
      <SatelliteList satellites={satellites} onToggleSatellite={handleToggleSatellite} />
    </Paper>
  )

  const rightSidebar = (
    <Paper
      elevation={2}
      sx={{ height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}
    >
      <Tabs
        value={rightTabValue}
        onChange={(_event: React.SyntheticEvent, newValue: number) => setRightTabValue(newValue)}
        variant="scrollable"
        scrollButtons="auto"
        sx={{
          borderBottom: 1,
          borderColor: 'divider',
          minHeight: 48,
          '& .MuiTab-root': {
            minHeight: 48,
            textTransform: 'none',
            fontSize: '0.875rem',
            fontWeight: 500,
            px: 2,
            minWidth: 'auto',
          },
        }}
      >
        <Tab icon={<MetricsIcon fontSize="small" />} iconPosition="start" label="Metrics" />
        <Tab icon={<AIIcon fontSize="small" />} iconPosition="start" label="AI Analyst" />
        <Tab
          icon={<ConjunctionIcon fontSize="small" />}
          iconPosition="start"
          label="Conjunctions"
        />
        <Tab icon={<AnomalyIcon fontSize="small" />} iconPosition="start" label="Anomalies" />
        <Tab icon={<TimelineIcon fontSize="small" />} iconPosition="start" label="Timeline" />
        <Tab icon={<MLIcon fontSize="small" />} iconPosition="start" label="ML Insights" />
      </Tabs>
      <Box sx={{ flexGrow: 1, overflow: 'hidden' }}>
        {rightTabValue === 0 && (
          <MetricsPanel
            satelliteName={primary?.name}
            noradId={primary?.noradId}
            telemetryData={scenario.telemetryData}
            currentTime={currentTime}
            tle={primary?.tle}
          />
        )}
        {rightTabValue === 1 && (
          <AITwinPanel
            recommendations={scenario.aiRecommendations}
            onSnapToTime={time => setCurrentTime(time)}
            noradIds={pairNoradIds}
            analysisPrompt={event ? analysisPrompt(event) : undefined}
          />
        )}
        {rightTabValue === 2 && (
          <ConjunctionFeed
            noradIds={noradIds}
            currentCdmId={event?.cdmId}
            onPlanManeuver={e =>
              setSnackbar({
                message: `Asked the assistant to plan a maneuver for ${e.satelliteA.name} × ${e.satelliteB.name}`,
                severity: 'info',
              })
            }
          />
        )}
        {rightTabValue === 3 && <AnomalyPanel noradIds={noradIds} />}
        {rightTabValue === 4 && (
          <TimelinePanel currentTime={currentTime} onTimeChange={handleTimeChange} />
        )}
        {rightTabValue === 5 && <MLInsightsPanel />}
      </Box>
    </Paper>
  )

  const tierColor = event ? TIER_COLOR[event.riskTier] : PASSED_COLOR

  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        height: 'calc(100vh - 64px)',
        position: 'relative',
      }}
    >
      {/* Event header */}
      <Paper
        elevation={2}
        sx={{
          px: 2,
          py: 1.5,
          borderRadius: 0,
          borderBottom: 1,
          borderColor: 'divider',
          zIndex: 10,
        }}
      >
        <Stack direction="row" spacing={2} alignItems="center" flexWrap="wrap" useFlexGap>
          <IconButton
            onClick={() => navigate('/scenarios')}
            size="small"
            aria-label="Back to the scenario library"
          >
            <BackIcon />
          </IconButton>

          <Box sx={{ flexGrow: 1, minWidth: 260 }}>
            <Breadcrumbs
              aria-label="breadcrumb"
              sx={{
                mb: 0.25,
                display: { xs: 'none', sm: 'flex' },
                '& .MuiBreadcrumbs-li': { fontSize: '0.8rem' },
              }}
            >
              <Link
                component="button"
                variant="body2"
                onClick={() => navigate('/')}
                sx={{
                  textDecoration: 'none',
                  color: 'text.secondary',
                  '&:hover': { color: 'primary.main' },
                }}
              >
                Home
              </Link>
              <Link
                component="button"
                variant="body2"
                onClick={() => navigate('/scenarios')}
                sx={{
                  textDecoration: 'none',
                  color: 'text.secondary',
                  '&:hover': { color: 'primary.main' },
                }}
              >
                Scenario Library
              </Link>
              <Typography variant="body2" color="text.primary" noWrap>
                CDM {event?.cdmId ?? scenarioId}
              </Typography>
            </Breadcrumbs>

            <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
              <Typography variant="h6" component="h1" noWrap fontWeight={700}>
                {scenario.name}
              </Typography>
              {event && <RiskTierChip tier={event.riskTier} />}
              <Chip
                icon={<SatelliteIcon />}
                label={`${scenario.satelliteCount} objects in view`}
                size="small"
                variant="outlined"
                sx={{ height: 22, fontSize: '0.7rem' }}
              />
            </Stack>
          </Box>

          {!isMobile && (
            <Stack direction="row" spacing={1}>
              {event && (
                <Button
                  size="small"
                  variant="outlined"
                  startIcon={<AIIcon />}
                  onClick={() => openAssistant({ tab: 'chat', prompt: analysisPrompt(event) })}
                  sx={{ textTransform: 'none' }}
                >
                  Ask assistant
                </Button>
              )}
              <Tooltip title="Download this event as JSON">
                <span>
                  <IconButton
                    size="small"
                    onClick={handleExport}
                    disabled={!event}
                    aria-label="Export event as JSON"
                  >
                    <ExportIcon />
                  </IconButton>
                </span>
              </Tooltip>
              <Tooltip title="Copy link to this event">
                <IconButton size="small" onClick={handleShare} aria-label="Copy link">
                  <ShareIcon />
                </IconButton>
              </Tooltip>
            </Stack>
          )}

          {isMobile && (
            <>
              <Tooltip title="Objects">
                <IconButton onClick={() => setLeftDrawerOpen(true)} size="small">
                  <SatelliteIcon />
                </IconButton>
              </Tooltip>
              <Tooltip title="Panels">
                <IconButton onClick={() => setRightDrawerOpen(true)} size="small">
                  <MenuIcon />
                </IconButton>
              </Tooltip>
            </>
          )}
        </Stack>

        {event && <EventFacts event={event} tierColor={tierColor} />}
      </Paper>

      {/* Main content: objects | 3D view | panels */}
      <Box sx={{ flexGrow: 1, display: 'flex', overflow: 'hidden' }}>
        {!isMobile && (
          <Box sx={{ width: '18%', minWidth: 220, maxWidth: 280, display: 'flex' }}>
            {leftSidebar}
          </Box>
        )}

        <Box sx={{ flexGrow: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          <Box sx={{ flexGrow: 1, overflow: 'hidden' }}>
            <Visualization3D
              satellites={satellites}
              currentTime={currentTime}
              onSatelliteClick={handleSatelliteClick}
              conjunctionWarnings={conjunctionWarnings}
            />
          </Box>
          <TimelineControl
            startTime={scenario.startTime}
            endTime={scenario.endTime}
            currentTime={currentTime}
            onTimeChange={handleTimeChange}
            markers={timelineMarkers}
          />
        </Box>

        {!isMobile && (
          <Box sx={{ width: '30%', minWidth: 320, maxWidth: 420, display: 'flex' }}>
            {rightSidebar}
          </Box>
        )}
      </Box>

      {isMobile && (
        <>
          <Drawer
            anchor="left"
            open={leftDrawerOpen}
            onClose={() => setLeftDrawerOpen(false)}
            PaperProps={{ sx: { width: '80%', maxWidth: 350 } }}
          >
            {leftSidebar}
          </Drawer>
          <Drawer
            anchor="right"
            open={rightDrawerOpen}
            onClose={() => setRightDrawerOpen(false)}
            PaperProps={{ sx: { width: '85%', maxWidth: 400 } }}
          >
            {rightSidebar}
          </Drawer>
        </>
      )}

      <Snackbar
        open={!!snackbar}
        autoHideDuration={3500}
        onClose={() => setSnackbar(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert
          onClose={() => setSnackbar(null)}
          severity={snackbar?.severity ?? 'success'}
          sx={{ width: '100%' }}
        >
          {snackbar?.message}
        </Alert>
      </Snackbar>
    </Box>
  )
}

/** Key figures for the event; the countdown and maneuver window tick on their own clock. */
const EventFacts: React.FC<{ event: ConjunctionView; tierColor: string }> = ({
  event,
  tierColor,
}) => {
  const now = useNow(1000)
  const upcoming = isUpcoming(event, now)
  const maneuver = showManeuver(event, now)
  const win = maneuver ? maneuverWindow(event, now) : null
  const history = event.pcHistory.map(p => p.pc)
  return (
    <Stack
      direction="row"
      spacing={3}
      alignItems="center"
      flexWrap="wrap"
      useFlexGap
      divider={<Divider orientation="vertical" flexItem />}
      sx={{ mt: 1.25, pl: { sm: 6 } }}
    >
      <Fact label="TCA (UTC)" hint="Time of closest approach from the latest CDM">
        <Stack direction="row" spacing={0.75} alignItems="center">
          <TimeIcon sx={{ fontSize: 15, color: upcoming ? tierColor : PASSED_COLOR }} />
          <span>{formatUtc(event.tca, { seconds: true })}</span>
          <Typography component="span" variant="caption" color="text.secondary">
            <TcaCountdown tcaMs={event.tcaMs} />
          </Typography>
        </Stack>
      </Fact>
      <Fact label="Miss distance" hint="Predicted minimum range at TCA">
        {formatMissDistance(event.missDistanceM)}
      </Fact>
      <Fact
        label="Pc (18 SDS)"
        hint="Probability of collision reported in the CDM by the 18th Space Defense Squadron"
      >
        <PcValue pc={event.rawPc} variant="body2" fontWeight={700} sx={{ color: tierColor }} />
      </Fact>
      <Fact
        label="Pc (ML)"
        hint="OrbitWatch XGBoost estimate for the same event, shown for comparison"
      >
        <PcValue pc={event.mlPc} variant="body2" fontWeight={700} />
      </Fact>
      <Fact label="CDM updates" hint="Conjunction data messages received for this event">
        <Stack direction="row" spacing={1} alignItems="center">
          <span>{event.cdmCount}</span>
          <PcSparkline values={history} color={tierColor} width={64} height={18} />
        </Stack>
      </Fact>
      <Fact label="Objects (NORAD)">
        {event.satelliteA.noradId} {'×'} {event.satelliteB.noradId}
      </Fact>
      <Fact
        label="Status"
        hint="Maneuver advice applies only before TCA and inside the planning window (TCA minus 48 h to TCA minus 6 h)"
      >
        {!upcoming ? (
          <Box component="span" sx={{ color: PASSED_COLOR }}>
            Passed, no action applies
          </Box>
        ) : maneuver && win ? (
          win.state === 'closed' ? (
            <Box component="span" sx={{ color: PASSED_COLOR }}>
              Maneuver window closed
            </Box>
          ) : (
            <Stack direction="row" spacing={1} alignItems="center">
              <Box component="span" sx={{ color: tierColor }}>
                {win.state === 'open'
                  ? `Maneuver window open, ${formatDuration(win.untilMs - now)} left`
                  : `Window opens in ${formatDuration(win.atMs - now)}`}
              </Box>
              <Button
                size="small"
                variant="contained"
                color="warning"
                onClick={() => openAssistant({ tab: 'chat', prompt: maneuverPrompt(event) })}
                sx={{ textTransform: 'none', py: 0, fontSize: '0.72rem' }}
              >
                Plan maneuver
              </Button>
            </Stack>
          )
        ) : (
          <span>Monitoring</span>
        )}
      </Fact>
    </Stack>
  )
}

export default ScenarioDetailView

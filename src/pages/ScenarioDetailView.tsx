import React, { useState, useCallback } from 'react'
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
} from '@mui/material'
import {
  ArrowBack as BackIcon,
  FileDownload as ExportIcon,
  Share as ShareIcon,
  ContentCopy as CloneIcon,
  Satellite as SatelliteIcon,
  SmartToy as AIIcon,
  Menu as MenuIcon,
  Dashboard as MetricsIcon,
  Psychology as AnalyticsIcon,
  Construction as ManeuverIcon,
  Warning as ThreatIcon,
  Notifications as AlertIcon,
  Sensors as SSNIcon,
} from '@mui/icons-material'
import {
  mockScenarios,
  createScenarioVariant,
  saveScenarioVariant,
  threatObjects,
  ewThreats,
  c2Alerts,
  ssnDataSources,
  mockUsers,
} from '../data/scenarios'
import { addToRecentlyViewed } from '../utils/recentlyViewed'
import DataQualityBadge from '../components/DataQualityBadge'
import SatelliteList from '../components/SatelliteList'
import Visualization3D from '../components/Visualization3D'
import TimelineControl from '../components/TimelineControl'
import MetricsPanel from '../components/MetricsPanel'
import AITwinPanel from '../components/AITwinPanel'
import AnalyticsPanel from '../components/AnalyticsPanel'
import ManeuverPlanner from '../components/ManeuverPlanner'
import ThreatAssessmentPanel from '../components/ThreatAssessmentPanel'
import C2AlertPanel from '../components/C2AlertPanel'
import SSNDataFeed from '../components/SSNDataFeed'
import { useTheme as useMuiTheme } from '@mui/material/styles'
import { ManeuverAnalysis } from '../types'

const ScenarioDetailView: React.FC = () => {
  const { scenarioId } = useParams<{ scenarioId: string }>()
  const navigate = useNavigate()
  const theme = useMuiTheme()
  const isMobile = useMediaQuery(theme.breakpoints.down('md'))
  const [rightTabValue, setRightTabValue] = useState(0)
  const [leftDrawerOpen, setLeftDrawerOpen] = useState(false)
  const [rightDrawerOpen, setRightDrawerOpen] = useState(false)
  const [highlightedSensors, setHighlightedSensors] = useState<string[]>([])
  const [maneuverAnalysis, setManeuverAnalysis] = useState<ManeuverAnalysis | null>(null)
  const [snackbarOpen, setSnackbarOpen] = useState(false)
  const [snackbarMessage, setSnackbarMessage] = useState('')
  const [isLoading, setIsLoading] = useState(true)

  const scenario = mockScenarios.find(s => s.id === scenarioId)

  // Time state for 3D visualization
  const [currentTime, setCurrentTime] = useState<Date>(() =>
    scenario ? new Date(scenario.startTime) : new Date()
  )

  // Satellite selection state
  const [satellites, setSatellites] = useState(() => (scenario ? scenario.satellites : []))

  // Handlers must be defined before early returns to avoid conditional hooks
  const handleTimeChange = useCallback((newTime: Date) => {
    setCurrentTime(newTime)
  }, [])

  // Keyboard shortcuts - must be before early returns
  React.useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      // Close mobile drawers with Escape
      if (e.key === 'Escape') {
        setLeftDrawerOpen(false)
        setRightDrawerOpen(false)
        return
      }

      // Only process shortcuts if not typing in an input
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return
      }

      // Tab shortcuts
      switch (e.key.toLowerCase()) {
        case 'm':
          setRightTabValue(0) // Metrics
          if (isMobile) setRightDrawerOpen(true)
          break
        case 'a':
          setRightTabValue(1) // AI Twin
          if (isMobile) setRightDrawerOpen(true)
          break
        case 'n':
          setRightTabValue(2) // Analysis
          if (isMobile) setRightDrawerOpen(true)
          break
        case 'w':
          setRightTabValue(3) // What-If
          if (isMobile) setRightDrawerOpen(true)
          break
        case 't':
          setRightTabValue(4) // Threats
          if (isMobile) setRightDrawerOpen(true)
          break
        case 'c':
          setRightTabValue(5) // C2 Alerts
          if (isMobile) setRightDrawerOpen(true)
          break
        case 's':
          setRightTabValue(6) // SSN Feed
          if (isMobile) setRightDrawerOpen(true)
          break
        case 'l':
          if (isMobile) setLeftDrawerOpen(!leftDrawerOpen)
          break
        default:
          break
      }
    }

    window.addEventListener('keydown', handleKeyPress)
    return () => window.removeEventListener('keydown', handleKeyPress)
  }, [isMobile, leftDrawerOpen])

  // Update satellites when scenario changes and simulate loading
  React.useEffect(() => {
    if (scenario) {
      setIsLoading(true)
      setSatellites(scenario.satellites)
      setCurrentTime(new Date(scenario.startTime))

      // Add to recently viewed
      addToRecentlyViewed(scenario.id, scenario.name)

      // Simulate loading orbital calculations
      const timer = setTimeout(() => {
        setIsLoading(false)
      }, 500)

      return () => clearTimeout(timer)
    } else {
      setIsLoading(false)
    }
  }, [scenario])

  if (!scenario) {
    return (
      <Box sx={{ p: 4, textAlign: 'center' }}>
        <Typography variant="h5">Scenario not found</Typography>
        <Button onClick={() => navigate('/')} sx={{ mt: 2 }}>
          Back to Dashboard
        </Button>
      </Box>
    )
  }

  const getStatusColor = () => {
    return theme.palette.status[scenario.aiDecisionStatus]
  }

  const handleToggleSatellite = (satelliteId: string) => {
    setSatellites(prev =>
      prev.map(sat => (sat.id === satelliteId ? { ...sat, selected: !sat.selected } : sat))
    )
  }

  const handleSatelliteClick = (satellite: Satellite) => {
    handleToggleSatellite(satellite.id)
  }

  const handleSensorHighlight = (sensors: string[]) => {
    setHighlightedSensors(sensors)
    // Switch to Metrics tab to show highlighted sensors
    setRightTabValue(0)
  }

  const handleApplyManeuverToView = (analysis: ManeuverAnalysis) => {
    setManeuverAnalysis(analysis)
    setSnackbarMessage('Maneuver analysis applied to 3D view')
    setSnackbarOpen(true)
  }

  const handleSaveScenarioVariant = (analysis: ManeuverAnalysis) => {
    if (!scenario) return

    // Create the scenario variant
    const variant = createScenarioVariant(
      scenario,
      analysis.plan.satelliteId,
      analysis.plan,
      analysis.predictedOrbitalParams
    )

    // Save the variant (in a real app, this would persist to backend)
    saveScenarioVariant(variant)

    setSnackbarMessage(`Scenario variant saved: ${variant.name}`)
    setSnackbarOpen(true)

    // Could navigate to the new variant
    // navigate(`/scenario/${variant.id}`)
  }

  const handleCloseSnackbar = () => {
    setSnackbarOpen(false)
  }

  const leftSidebar = (
    <Paper
      elevation={2}
      sx={{
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}
    >
      <SatelliteList satellites={satellites} onToggleSatellite={handleToggleSatellite} />
    </Paper>
  )

  const rightSidebar = (
    <Paper
      elevation={2}
      sx={{
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}
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
        <Tab icon={<AIIcon fontSize="small" />} iconPosition="start" label="AI Twin" />
        <Tab icon={<AnalyticsIcon fontSize="small" />} iconPosition="start" label="Analysis" />
        <Tab icon={<ManeuverIcon fontSize="small" />} iconPosition="start" label="What-If" />
        <Tab
          icon={<ThreatIcon fontSize="small" />}
          iconPosition="start"
          label="Threats"
          sx={{
            '&.Mui-selected': {
              color: 'error.main',
            },
          }}
        />
        <Tab
          icon={<AlertIcon fontSize="small" />}
          iconPosition="start"
          label="C2 Alerts"
          sx={{
            '&.Mui-selected': {
              color: 'warning.main',
            },
          }}
        />
        <Tab icon={<SSNIcon fontSize="small" />} iconPosition="start" label="SSN Feed" />
      </Tabs>
      <Box sx={{ flexGrow: 1, overflow: 'hidden' }}>
        {rightTabValue === 0 && (
          <MetricsPanel
            satelliteName={scenario.satellites[0]?.name}
            telemetryData={scenario.telemetryData}
            highlightedSensors={highlightedSensors}
          />
        )}
        {rightTabValue === 1 && (
          <AITwinPanel
            recommendations={scenario.aiRecommendations}
            onSensorHighlight={handleSensorHighlight}
          />
        )}
        {rightTabValue === 2 && <AnalyticsPanel satelliteName={scenario.satellites[0]?.name} />}
        {rightTabValue === 3 && scenario.satellites[0] && (
          <ManeuverPlanner
            satellite={scenario.satellites[0]}
            otherSatellites={scenario.satellites.slice(1)}
            scenarioStartTime={scenario.startTime}
            onApplyToView={handleApplyManeuverToView}
            onSaveVariant={handleSaveScenarioVariant}
          />
        )}
        {rightTabValue === 4 && (
          <ThreatAssessmentPanel threatObjects={threatObjects} ewThreats={ewThreats} />
        )}
        {rightTabValue === 5 && (
          <C2AlertPanel
            alerts={c2Alerts}
            currentUserId={mockUsers[0].id}
            onAcknowledge={alertId => {
              console.log('Acknowledging alert:', alertId)
              setSnackbarMessage(`Alert ${alertId} acknowledged`)
              setSnackbarOpen(true)
            }}
            onDisseminate={alertId => {
              console.log('Disseminating alert:', alertId)
              setSnackbarMessage(`Alert ${alertId} disseminated`)
              setSnackbarOpen(true)
            }}
          />
        )}
        {rightTabValue === 6 && <SSNDataFeed sources={ssnDataSources} />}
      </Box>
    </Paper>
  )

  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        height: 'calc(100vh - 160px)',
        position: 'relative',
      }}
    >
      {/* Loading Overlay */}
      {isLoading && (
        <Box
          sx={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: 'rgba(0, 0, 0, 0.5)',
            zIndex: 9999,
            backdropFilter: 'blur(4px)',
          }}
        >
          <CircularProgress size={60} thickness={4} />
          <Typography variant="h6" sx={{ mt: 2, color: 'white' }}>
            Loading orbital data...
          </Typography>
          <Typography variant="body2" sx={{ mt: 1, color: 'grey.300' }}>
            Calculating trajectories and propagating orbits
          </Typography>
        </Box>
      )}

      {/* Top Control Bar */}
      <Paper
        elevation={2}
        sx={{
          p: 2,
          borderRadius: 0,
          borderBottom: 1,
          borderColor: 'divider',
          zIndex: 10,
        }}
      >
        <Stack direction="row" spacing={2} alignItems="center" flexWrap="wrap">
          <IconButton onClick={() => navigate('/')} size="small">
            <BackIcon />
          </IconButton>

          <Box sx={{ flexGrow: 1, minWidth: 200 }}>
            {/* Breadcrumbs */}
            <Breadcrumbs
              aria-label="breadcrumb"
              sx={{ mb: 0.5, display: { xs: 'none', sm: 'flex' } }}
            >
              <Link
                component="button"
                variant="body2"
                onClick={() => navigate('/')}
                sx={{
                  textDecoration: 'none',
                  color: 'text.secondary',
                  '&:hover': { color: 'primary.main', textDecoration: 'underline' },
                  cursor: 'pointer',
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
                  '&:hover': { color: 'primary.main', textDecoration: 'underline' },
                  cursor: 'pointer',
                }}
              >
                Scenario Library
              </Link>
              <Typography variant="body2" color="text.primary">
                {scenario.name}
              </Typography>
            </Breadcrumbs>

            <Stack direction="row" spacing={1} alignItems="center">
              <Typography variant="h6" component="h1" noWrap>
                {scenario.name}
              </Typography>
              <DataQualityBadge quality={scenario.dataQuality} />
            </Stack>
            <Stack direction="row" spacing={2} alignItems="center" flexWrap="wrap">
              <Chip
                icon={<SatelliteIcon />}
                label={`${scenario.satelliteCount} satellites`}
                size="small"
                variant="outlined"
              />
              <Chip
                icon={<AIIcon />}
                label={scenario.aiDecisionStatus}
                size="small"
                sx={{
                  backgroundColor: getStatusColor(),
                  color: 'white',
                  textTransform: 'capitalize',
                }}
              />
              <Typography variant="caption" color="text.secondary">
                {new Date(scenario.startTime).toLocaleString()}
              </Typography>
            </Stack>
          </Box>

          {!isMobile && (
            <Stack direction="row" spacing={1}>
              <Tooltip title="Export Data">
                <IconButton
                  size="small"
                  onClick={() => {
                    setSnackbarMessage('Exporting scenario data...')
                    setSnackbarOpen(true)
                  }}
                >
                  <ExportIcon />
                </IconButton>
              </Tooltip>
              <Tooltip title="Share">
                <IconButton
                  size="small"
                  onClick={() => {
                    setSnackbarMessage('Share link copied to clipboard')
                    setSnackbarOpen(true)
                  }}
                >
                  <ShareIcon />
                </IconButton>
              </Tooltip>
              <Tooltip title="Clone Scenario">
                <IconButton
                  size="small"
                  onClick={() => {
                    setSnackbarMessage('Scenario cloned successfully')
                    setSnackbarOpen(true)
                  }}
                >
                  <CloneIcon />
                </IconButton>
              </Tooltip>
            </Stack>
          )}

          {isMobile && (
            <>
              <Tooltip title="Satellites">
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
      </Paper>

      {/* Main Content Area */}
      <Box sx={{ flexGrow: 1, display: 'flex', overflow: 'hidden' }}>
        {/* Left Sidebar - Desktop only */}
        {!isMobile && (
          <Box sx={{ width: '20%', minWidth: 250, maxWidth: 350, display: 'flex' }}>
            {leftSidebar}
          </Box>
        )}

        {/* Center - 3D Visualization */}
        <Box
          sx={{
            flexGrow: 1,
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            position: 'relative',
          }}
        >
          <Box sx={{ flexGrow: 1, overflow: 'hidden' }}>
            <Visualization3D
              satellites={satellites}
              currentTime={currentTime}
              onSatelliteClick={handleSatelliteClick}
              maneuverAnalysis={maneuverAnalysis}
            />
          </Box>
          <Box sx={{ flexShrink: 0 }}>
            <TimelineControl
              startTime={scenario.startTime}
              endTime={scenario.endTime}
              currentTime={currentTime}
              onTimeChange={handleTimeChange}
            />
          </Box>
        </Box>

        {/* Right Sidebar - Desktop only */}
        {!isMobile && (
          <Box sx={{ width: '25%', minWidth: 300, maxWidth: 400, display: 'flex' }}>
            {rightSidebar}
          </Box>
        )}
      </Box>

      {/* Mobile Drawers */}
      {isMobile && (
        <>
          <Drawer
            anchor="left"
            open={leftDrawerOpen}
            onClose={() => setLeftDrawerOpen(false)}
            PaperProps={{
              sx: { width: '80%', maxWidth: 350 },
            }}
          >
            {leftSidebar}
          </Drawer>
          <Drawer
            anchor="right"
            open={rightDrawerOpen}
            onClose={() => setRightDrawerOpen(false)}
            PaperProps={{
              sx: { width: '85%', maxWidth: 400 },
            }}
          >
            {rightSidebar}
          </Drawer>
        </>
      )}

      {/* Snackbar for notifications */}
      <Snackbar
        open={snackbarOpen}
        autoHideDuration={3000}
        onClose={handleCloseSnackbar}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert onClose={handleCloseSnackbar} severity="success" sx={{ width: '100%' }}>
          {snackbarMessage}
        </Alert>
      </Snackbar>
    </Box>
  )
}

export default ScenarioDetailView

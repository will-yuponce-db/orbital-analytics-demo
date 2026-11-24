import React from 'react'
import { Link, useLocation } from 'react-router-dom'
import {
  AppBar,
  Box,
  Button,
  Chip,
  Stack,
  Toolbar,
  Tooltip,
  Typography,
  type Theme,
} from '@mui/material'
import { alpha } from '@mui/material/styles'
import SatelliteAltIcon from '@mui/icons-material/SatelliteAlt'
import HomeIcon from '@mui/icons-material/Home'
import DashboardIcon from '@mui/icons-material/Dashboard'
import InfoIcon from '@mui/icons-material/Info'
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline'
import ScheduleIcon from '@mui/icons-material/Schedule'
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline'
import HelpOutlineIcon from '@mui/icons-material/HelpOutline'
import PsychologyIcon from '@mui/icons-material/Psychology'
import SmartToyIcon from '@mui/icons-material/SmartToy'
import UserProfileBadge from './UserProfileBadge'
import { mockUsers } from '../data/scenarios'
import useOverview, { overviewHasData } from '../hooks/useOverview'
import useNow from '../hooks/useNow'
import { formatAgeCompact, formatInt, formatPc, formatUtc, prettyModelName } from '../utils/format'
import { openAssistant } from '../utils/assistant'

interface LayoutProps {
  children: React.ReactNode
}

const GREY = '#90a4ae'

const statusChipSx = (color: string) => ({
  height: 26,
  fontWeight: 700,
  fontSize: '0.68rem',
  letterSpacing: 0.4,
  color,
  bgcolor: alpha(color, 0.12),
  border: `1px solid ${alpha(color, 0.45)}`,
  '& .MuiChip-icon': { color, fontSize: 16, ml: '6px' },
})

const NAV = [
  { to: '/', label: 'Home', icon: <HomeIcon /> },
  { to: '/scenarios', label: 'Scenarios', icon: <DashboardIcon /> },
  { to: '/about', label: 'About', icon: <InfoIcon /> },
]

/** Data freshness from the newest CDM creation time: green under 12 h, amber under 48 h, red beyond. */
const FreshnessChip: React.FC<{
  dataAsOf: string | null
  lastLoadedAt: string | null
  loading: boolean
}> = ({ dataAsOf, lastLoadedAt, loading }) => {
  const now = useNow(60_000)
  const asOf = dataAsOf ? Date.parse(dataAsOf) : NaN
  if (Number.isNaN(asOf)) {
    if (loading) {
      return (
        <Tooltip title="Checking data freshness">
          <Chip size="small" icon={<HelpOutlineIcon />} label="DATA ..." sx={statusChipSx(GREY)} />
        </Tooltip>
      )
    }
    return (
      <Tooltip title="Could not read the newest CDM time from Lakebase. Live figures may be missing.">
        <Chip
          size="small"
          icon={<ErrorOutlineIcon />}
          label="NO DATA"
          sx={statusChipSx('#ef5350')}
        />
      </Tooltip>
    )
  }
  const ageMs = Math.max(0, now - asOf)
  const hours = ageMs / 3_600_000
  const { color, Icon, word }: { color: string; Icon: typeof ScheduleIcon; word: string } =
    hours < 12
      ? { color: '#66bb6a', Icon: CheckCircleOutlineIcon, word: 'Fresh' }
      : hours < 48
        ? { color: '#ffa726', Icon: ScheduleIcon, word: 'Aging' }
        : { color: '#ef5350', Icon: ErrorOutlineIcon, word: 'Stale' }
  return (
    <Tooltip
      title={
        <>
          {word}: newest CDM created {formatUtc(asOf, { seconds: true })}.
          {lastLoadedAt ? (
            <>
              <br />
              Last load into Lakebase: {formatUtc(lastLoadedAt, { seconds: true })}.
            </>
          ) : null}
          <br />
          Green under 12 h, amber under 48 h, red beyond.
        </>
      }
    >
      <Chip
        size="small"
        icon={<Icon />}
        label={`DATA ${formatAgeCompact(ageMs).toUpperCase()} AGO`}
        sx={statusChipSx(color)}
      />
    </Tooltip>
  )
}

const Layout: React.FC<LayoutProps> = ({ children }) => {
  const location = useLocation()
  // First mock profile stands in for the signed-in operator.
  const currentUser = mockUsers[0]
  const { data, loading } = useOverview()
  const healthy = overviewHasData(data)
  const model = data?.model ?? null
  const version = model?.version ? model.version.replace(/^v/i, '') : null
  const chatName = prettyModelName(data?.chatModel) ?? 'Claude'

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
      <AppBar
        position="fixed"
        elevation={0}
        sx={{
          top: 0,
          zIndex: (theme: Theme) => theme.zIndex.drawer + 1,
          bgcolor: 'rgba(14, 20, 38, 0.92)',
          backdropFilter: 'blur(8px)',
          borderBottom: '1px solid rgba(255,255,255,0.08)',
        }}
      >
        <Toolbar>
          <Box
            component={Link}
            to="/"
            sx={{
              display: 'flex',
              alignItems: 'center',
              color: 'inherit',
              textDecoration: 'none',
              flexGrow: 1,
              minWidth: 0,
            }}
          >
            <SatelliteAltIcon sx={{ mr: 1.25, fontSize: 30, color: 'primary.light' }} />
            <Box sx={{ minWidth: 0 }}>
              <Typography
                variant="h6"
                noWrap
                component="div"
                sx={{ fontWeight: 700, lineHeight: 1.1 }}
              >
                OrbitWatch
              </Typography>
              <Typography
                variant="caption"
                noWrap
                component="div"
                sx={{ color: 'text.secondary', letterSpacing: 1, fontSize: '0.62rem' }}
              >
                SPACE DOMAIN AWARENESS
              </Typography>
            </Box>
          </Box>

          <Stack direction="row" spacing={1} sx={{ mr: 2, display: { xs: 'none', sm: 'flex' } }}>
            {NAV.map(item => {
              const active =
                item.to === '/' ? location.pathname === '/' : location.pathname.startsWith(item.to)
              return (
                <Button
                  key={item.to}
                  component={Link}
                  to={item.to}
                  startIcon={item.icon}
                  color="inherit"
                  variant={active ? 'outlined' : 'text'}
                  sx={{ borderColor: active ? 'rgba(255,255,255,0.7)' : 'transparent' }}
                >
                  {item.label}
                </Button>
              )
            })}
          </Stack>

          {/* Live system status */}
          <Stack
            direction="row"
            spacing={1}
            sx={{ mr: 2, display: { xs: 'none', lg: 'flex' } }}
            alignItems="center"
          >
            <FreshnessChip
              dataAsOf={data?.dataAsOf ?? null}
              lastLoadedAt={data?.lastLoadedAt ?? null}
              loading={loading}
            />

            {model ? (
              <Tooltip
                title={
                  <>
                    {model.name ?? 'XGBoost Pc model'}
                    {version ? ` v${version}` : ''}
                    {model.trainedAt ? `, trained ${formatUtc(model.trainedAt)}` : ''}
                    <br />R{'²'} (log Pc) {model.r2 != null ? model.r2.toFixed(2) : 'n/a'}
                    {model.mae != null ? `, MAE ${formatPc(model.mae)}` : ''}
                    <br />
                    {formatInt(model.nTraining)} training CDMs, {formatInt(model.nScored)} scored
                  </>
                }
              >
                <Chip
                  size="small"
                  icon={<PsychologyIcon />}
                  label={version ? `ML MODEL V${version.toUpperCase()}` : 'ML MODEL'}
                  sx={statusChipSx('#4fc3f7')}
                />
              </Tooltip>
            ) : (
              <Tooltip
                title={
                  loading
                    ? 'Checking model status'
                    : healthy
                      ? 'No model summary has been published to Lakebase. Pc (ML) values may be missing or stale.'
                      : 'Model status unknown: Lakebase did not respond.'
                }
              >
                <Chip
                  size="small"
                  icon={<PsychologyIcon />}
                  label={loading ? 'ML ...' : healthy ? 'ML OFFLINE' : 'ML N/A'}
                  sx={statusChipSx(GREY)}
                />
              </Tooltip>
            )}

            <Tooltip
              title={`${chatName} on Databricks Model Serving. Answers with tool calls against the live Lakebase data. Click to open.`}
            >
              <Chip
                size="small"
                icon={<SmartToyIcon />}
                label="AI ASSISTANT"
                onClick={() => openAssistant({ tab: 'chat' })}
                sx={{ ...statusChipSx('#b39ddb'), cursor: 'pointer' }}
              />
            </Tooltip>
          </Stack>

          <UserProfileBadge user={currentUser} />
        </Toolbar>
      </AppBar>

      <Box
        component="main"
        sx={{
          flexGrow: 1,
          width: '100%',
          backgroundColor: 'background.default',
          paddingTop: '64px',
        }}
      >
        {children}
      </Box>
    </Box>
  )
}

export default Layout

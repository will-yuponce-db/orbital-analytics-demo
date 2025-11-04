import React from 'react'
import {
  Box,
  Typography,
  Paper,
  Stack,
  Chip,
  List,
  Divider,
  Alert,
  LinearProgress,
  Grid,
} from '@mui/material'
import {
  Warning as WarningIcon,
  Security as SecurityIcon,
  Radar as RadarIcon,
  FlashOn as FlashIcon,
} from '@mui/icons-material'
import { ThreatObject, ThreatLevel, EWThreat } from '../types'

interface ThreatAssessmentPanelProps {
  threatObjects: ThreatObject[]
  ewThreats: EWThreat[]
  onThreatSelect?: (threatId: string) => void
}

const ThreatAssessmentPanel: React.FC<ThreatAssessmentPanelProps> = ({
  threatObjects,
  ewThreats,
  onThreatSelect,
}) => {
  const getThreatLevelColor = (level: ThreatLevel): 'success' | 'info' | 'warning' | 'error' => {
    switch (level) {
      case 'critical':
        return 'error'
      case 'high':
        return 'error'
      case 'moderate':
        return 'warning'
      case 'low':
        return 'info'
      default:
        return 'success'
    }
  }

  const getThreatIcon = (type: string) => {
    switch (type) {
      case 'hostile-satellite':
      case 'co-orbital-threat':
        return <RadarIcon />
      case 'asat-weapon':
      case 'kinetic-intercept':
        return <FlashIcon />
      case 'electronic-attack':
        return <SecurityIcon />
      default:
        return <WarningIcon />
    }
  }

  const getBehaviorColor = (behavior: string): string => {
    switch (behavior) {
      case 'aggressive':
        return 'error.main'
      case 'surveillance':
        return 'warning.main'
      case 'proximity-ops':
        return 'warning.main'
      default:
        return 'text.secondary'
    }
  }

  const criticalThreats = threatObjects.filter(
    t => t.threatLevel === 'critical' || t.threatLevel === 'high'
  )
  const activeEWThreats = ewThreats.filter(t => !t.endTime)

  return (
    <Box sx={{ height: '100%', overflow: 'auto', p: 2 }}>
      <Stack spacing={3}>
        {/* Header */}
        <Box>
          <Stack direction="row" spacing={1} alignItems="center">
            <SecurityIcon color="error" />
            <Typography variant="h6">Threat Assessment</Typography>
          </Stack>
          <Typography variant="caption" color="text.secondary">
            Space Domain Awareness - Hostile Object Tracking
          </Typography>
        </Box>

        {/* Threat Summary */}
        <Paper variant="outlined" sx={{ p: 2, bgcolor: 'background.default' }}>
          <Grid container spacing={2}>
            <Grid item xs={6}>
              <Typography variant="h3" color="error.main" fontWeight="bold">
                {criticalThreats.length}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                Critical Threats
              </Typography>
            </Grid>
            <Grid item xs={6}>
              <Typography variant="h3" color="warning.main" fontWeight="bold">
                {activeEWThreats.length}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                Active EW Attacks
              </Typography>
            </Grid>
          </Grid>
        </Paper>

        {/* Critical Alerts */}
        {criticalThreats.length > 0 && (
          <Alert severity="error" icon={<WarningIcon />}>
            <Typography variant="body2" fontWeight="bold">
              {criticalThreats.length} HIGH PRIORITY THREAT{criticalThreats.length > 1 ? 'S' : ''}{' '}
              DETECTED
            </Typography>
            <Typography variant="caption">
              Immediate action may be required. Review threat details below.
            </Typography>
          </Alert>
        )}

        <Divider />

        {/* Threat Objects List */}
        <Box>
          <Typography variant="subtitle2" gutterBottom fontWeight="bold">
            Hostile Objects ({threatObjects.length})
          </Typography>
          <List sx={{ p: 0 }}>
            {threatObjects.map(threat => (
              <Paper
                key={threat.id}
                elevation={2}
                sx={{
                  mb: 2,
                  p: 2,
                  cursor: 'pointer',
                  border: threat.threatLevel === 'critical' ? '2px solid' : '1px solid',
                  borderColor: threat.threatLevel === 'critical' ? 'error.main' : 'divider',
                  '&:hover': {
                    bgcolor: 'action.hover',
                  },
                }}
                onClick={() => onThreatSelect?.(threat.id)}
              >
                <Stack spacing={1.5}>
                  {/* Header */}
                  <Box display="flex" justifyContent="space-between" alignItems="flex-start">
                    <Stack direction="row" spacing={1} alignItems="center">
                      {getThreatIcon(threat.threatType)}
                      <Box>
                        <Typography variant="body1" fontWeight="bold">
                          {threat.name}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          NORAD: {threat.noradId} | Origin: {threat.countryOfOrigin}
                        </Typography>
                      </Box>
                    </Stack>
                    <Chip
                      label={threat.threatLevel.toUpperCase()}
                      color={getThreatLevelColor(threat.threatLevel)}
                      size="small"
                      sx={{ fontWeight: 'bold' }}
                    />
                  </Box>

                  {/* Threat Details */}
                  <Box>
                    <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                      <Chip
                        label={threat.threatType.replace(/-/g, ' ').toUpperCase()}
                        size="small"
                        variant="outlined"
                      />
                      <Chip
                        label={threat.behaviorProfile.toUpperCase()}
                        size="small"
                        sx={{ color: getBehaviorColor(threat.behaviorProfile) }}
                      />
                      {threat.targetedAssets && threat.targetedAssets.length > 0 && (
                        <Chip
                          label={`Targeting ${threat.targetedAssets.length} Asset(s)`}
                          size="small"
                          color="error"
                          variant="outlined"
                        />
                      )}
                    </Stack>
                  </Box>

                  {/* Orbital Info */}
                  <Box>
                    <Typography variant="caption" color="text.secondary">
                      Alt: {threat.altitude.toFixed(1)} km | Vel: {threat.velocity.toFixed(2)} km/s
                      | Inc: {threat.orbitalParams.inclination.toFixed(1)}°
                    </Typography>
                  </Box>

                  {/* Capabilities */}
                  {threat.capabilities && threat.capabilities.length > 0 && (
                    <Box>
                      <Typography
                        variant="caption"
                        color="text.secondary"
                        display="block"
                        gutterBottom
                      >
                        Detected Capabilities:
                      </Typography>
                      <Stack direction="row" spacing={0.5} flexWrap="wrap" useFlexGap>
                        {threat.capabilities.map((cap, idx) => (
                          <Chip
                            key={idx}
                            label={`${cap.type} (${cap.detectionConfidence}%)`}
                            size="small"
                            color="warning"
                            sx={{ fontSize: '0.7rem', height: 20 }}
                          />
                        ))}
                      </Stack>
                    </Box>
                  )}

                  {/* Maneuver History */}
                  {threat.maneuverHistory.length > 0 && (
                    <Box>
                      <Typography variant="caption" color="text.secondary">
                        Recent Maneuvers: {threat.maneuverHistory.length} detected
                        {threat.maneuverHistory.some(m => m.assessed === 'hostile') && (
                          <Chip
                            label="HOSTILE MANEUVERS"
                            size="small"
                            color="error"
                            sx={{ ml: 1, height: 18, fontSize: '0.65rem' }}
                          />
                        )}
                      </Typography>
                    </Box>
                  )}

                  {/* First Detected */}
                  <Typography variant="caption" color="text.secondary">
                    First Detected: {new Date(threat.firstDetected).toLocaleString()}
                  </Typography>
                </Stack>
              </Paper>
            ))}
          </List>

          {threatObjects.length === 0 && (
            <Box sx={{ textAlign: 'center', py: 4 }}>
              <SecurityIcon sx={{ fontSize: 60, color: 'text.disabled', mb: 2 }} />
              <Typography variant="body2" color="text.secondary">
                No hostile objects currently tracked
              </Typography>
            </Box>
          )}
        </Box>

        <Divider />

        {/* Electronic Warfare Threats */}
        <Box>
          <Typography variant="subtitle2" gutterBottom fontWeight="bold">
            Electronic Warfare Threats ({ewThreats.length})
          </Typography>
          <List sx={{ p: 0 }}>
            {ewThreats.map(ew => (
              <Paper
                key={ew.id}
                elevation={1}
                sx={{
                  mb: 2,
                  p: 2,
                  border: !ew.endTime ? '1px solid' : 'none',
                  borderColor: 'warning.main',
                }}
              >
                <Stack spacing={1}>
                  <Box display="flex" justifyContent="space-between" alignItems="center">
                    <Stack direction="row" spacing={1} alignItems="center">
                      <FlashIcon color="warning" />
                      <Typography variant="body2" fontWeight="bold">
                        {ew.type.toUpperCase().replace(/-/g, ' ')}
                      </Typography>
                    </Stack>
                    <Chip
                      label={ew.endTime ? 'RESOLVED' : 'ACTIVE'}
                      color={ew.endTime ? 'success' : 'error'}
                      size="small"
                    />
                  </Box>

                  <Typography variant="caption" color="text.secondary">
                    Affected Satellites: {ew.affectedSatellites.length}
                  </Typography>

                  <Typography variant="caption" color="text.secondary">
                    Frequencies: {ew.affectedFrequencies.join(', ')}
                  </Typography>

                  {ew.sourceLocation && (
                    <Typography variant="caption" color="text.secondary">
                      Source:{' '}
                      {ew.sourceLocation.groundStation ||
                        `${ew.sourceLocation.latitude.toFixed(2)}°, ${ew.sourceLocation.longitude.toFixed(2)}°`}
                    </Typography>
                  )}

                  <Box>
                    <Typography
                      variant="caption"
                      color="text.secondary"
                      display="block"
                      gutterBottom
                    >
                      Severity: {ew.severity.toUpperCase()}
                    </Typography>
                    <LinearProgress
                      variant="determinate"
                      value={
                        ew.severity === 'critical'
                          ? 100
                          : ew.severity === 'high'
                            ? 75
                            : ew.severity === 'moderate'
                              ? 50
                              : 25
                      }
                      color={getThreatLevelColor(ew.severity)}
                      sx={{ height: 6, borderRadius: 1 }}
                    />
                  </Box>

                  <Typography variant="caption" color="text.secondary">
                    {new Date(ew.startTime).toLocaleString()}
                    {ew.endTime && ` - ${new Date(ew.endTime).toLocaleString()}`}
                  </Typography>
                </Stack>
              </Paper>
            ))}
          </List>

          {ewThreats.length === 0 && (
            <Box sx={{ textAlign: 'center', py: 2 }}>
              <Typography variant="body2" color="text.secondary">
                No EW threats detected
              </Typography>
            </Box>
          )}
        </Box>
      </Stack>
    </Box>
  )
}

export default ThreatAssessmentPanel

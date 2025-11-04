import React, { useState, useEffect, useCallback, useRef } from 'react'
import {
  Box,
  Paper,
  Typography,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Slider,
  TextField,
  Button,
  Stack,
  Divider,
  Table,
  TableBody,
  TableRow,
  TableCell,
  Alert,
  Chip,
} from '@mui/material'
import { Save as SaveIcon, Refresh as ResetIcon, Visibility as ViewIcon } from '@mui/icons-material'
import {
  ManeuverType,
  ManeuverPlan,
  ManeuverAnalysis,
  Satellite,
  OrbitalParameters,
} from '../types'
import { analyzeManeuver } from '../utils/maneuverCalculations'

interface ManeuverPlannerProps {
  satellite: Satellite
  otherSatellites: Satellite[]
  scenarioStartTime: string
  onApplyToView: (analysis: ManeuverAnalysis) => void
  onSaveVariant: (analysis: ManeuverAnalysis) => void
}

const ManeuverPlanner: React.FC<ManeuverPlannerProps> = ({
  satellite,
  otherSatellites,
  scenarioStartTime,
  onApplyToView,
  onSaveVariant,
}) => {
  const [maneuverType, setManeuverType] = useState<ManeuverType>('orbit-raising')
  const [targetAltitude, setTargetAltitude] = useState(satellite.altitude + 50)
  const [targetInclination, setTargetInclination] = useState(satellite.orbitalParams.inclination)
  const [safetyDistance, setSafetyDistance] = useState(5)
  const [executionTime, setExecutionTime] = useState<string>(scenarioStartTime)
  const [analysis, setAnalysis] = useState<ManeuverAnalysis | null>(null)
  const maneuverIdCounter = useRef(0)

  const getManeuverDescription = useCallback((): string => {
    switch (maneuverType) {
      case 'orbit-raising':
        return `Raise orbit to ${targetAltitude.toFixed(1)} km altitude`
      case 'orbit-lowering':
        return `Lower orbit to ${targetAltitude.toFixed(1)} km altitude`
      case 'inclination-change':
        return `Change inclination to ${targetInclination.toFixed(2)}°`
      case 'collision-avoidance':
        return `Collision avoidance maneuver with ${safetyDistance} km safety margin`
      case 'station-keeping':
        return 'Station-keeping correction maneuver'
      default:
        return 'Maneuver'
    }
  }, [maneuverType, targetAltitude, targetInclination, safetyDistance])

  const calculateAnalysis = useCallback(() => {
    let targetParameters: Partial<OrbitalParameters> = {}

    switch (maneuverType) {
      case 'orbit-raising':
      case 'orbit-lowering':
        targetParameters = {
          semiMajorAxis: 6371 + targetAltitude, // Earth radius + altitude
        }
        break
      case 'inclination-change':
        targetParameters = {
          inclination: targetInclination,
        }
        break
      case 'collision-avoidance':
        // Safety distance handled in calculation
        break
      case 'station-keeping':
        targetParameters = {
          semiMajorAxis: satellite.orbitalParams.semiMajorAxis,
          inclination: satellite.orbitalParams.inclination,
        }
        break
    }

    maneuverIdCounter.current += 1
    const plan: ManeuverPlan = {
      id: `maneuver-${maneuverIdCounter.current}`,
      type: maneuverType,
      satelliteId: satellite.id,
      executionTime,
      deltaV: {
        x: 0,
        y: 0,
        z: 0,
        magnitude: 0,
      },
      targetParameters,
      description: getManeuverDescription(),
    }

    const newAnalysis = analyzeManeuver(plan, satellite.orbitalParams, otherSatellites)

    // Update deltaV in plan
    plan.deltaV.magnitude = newAnalysis.fuelCostDeltaV

    setAnalysis(newAnalysis)
  }, [maneuverType, targetAltitude, targetInclination, executionTime, satellite, otherSatellites, getManeuverDescription])

  // Calculate analysis when parameters change
  useEffect(() => {
    calculateAnalysis()
  }, [calculateAnalysis])

  const handleReset = () => {
    setTargetAltitude(satellite.altitude + 50)
    setTargetInclination(satellite.orbitalParams.inclination)
    setSafetyDistance(5)
    setExecutionTime(scenarioStartTime)
  }

  const handleApplyToView = () => {
    if (analysis) {
      onApplyToView(analysis)
    }
  }

  const handleSaveVariant = () => {
    if (analysis) {
      onSaveVariant(analysis)
    }
  }

  const getRiskColor = (probability: number): string => {
    if (probability < 10) return 'success'
    if (probability < 30) return 'warning'
    return 'error'
  }

  return (
    <Box sx={{ height: '100%', overflow: 'auto', p: 2 }}>
      <Stack spacing={3}>
        {/* Header */}
        <Box>
          <Typography variant="h6" gutterBottom>
            What-If Maneuver Planner
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Plan and analyze orbital maneuvers for {satellite.name}
          </Typography>
        </Box>

        <Divider />

        {/* Maneuver Type Selection */}
        <FormControl fullWidth>
          <InputLabel>Maneuver Type</InputLabel>
          <Select
            value={maneuverType}
            label="Maneuver Type"
            onChange={e => setManeuverType(e.target.value as ManeuverType)}
          >
            <MenuItem value="orbit-raising">Orbit Raising</MenuItem>
            <MenuItem value="orbit-lowering">Orbit Lowering</MenuItem>
            <MenuItem value="inclination-change">Inclination Change</MenuItem>
            <MenuItem value="collision-avoidance">Collision Avoidance</MenuItem>
            <MenuItem value="station-keeping">Station Keeping</MenuItem>
          </Select>
        </FormControl>

        {/* Dynamic Input Fields */}
        {(maneuverType === 'orbit-raising' || maneuverType === 'orbit-lowering') && (
          <Box>
            <Typography gutterBottom>Target Altitude: {targetAltitude.toFixed(1)} km</Typography>
            <Slider
              value={targetAltitude}
              onChange={(_event: Event, value: number | number[]) =>
                setTargetAltitude(value as number)
              }
              min={200}
              max={2000}
              step={10}
              marks={[
                { value: 200, label: '200 km' },
                { value: 1000, label: '1000 km' },
                { value: 2000, label: '2000 km' },
              ]}
              valueLabelDisplay="auto"
            />
            <Typography variant="caption" color="text.secondary">
              Current altitude: {satellite.altitude.toFixed(1)} km
            </Typography>
          </Box>
        )}

        {maneuverType === 'inclination-change' && (
          <TextField
            label="Target Inclination (degrees)"
            type="number"
            value={targetInclination}
            onChange={e => setTargetInclination(parseFloat(e.target.value))}
            fullWidth
            inputProps={{ min: 0, max: 180, step: 0.1 }}
            helperText={`Current inclination: ${satellite.orbitalParams.inclination.toFixed(2)}°`}
          />
        )}

        {maneuverType === 'collision-avoidance' && (
          <Box>
            <Typography gutterBottom>Safety Distance: {safetyDistance.toFixed(1)} km</Typography>
            <Slider
              value={safetyDistance}
              onChange={(_event: Event, value: number | number[]) =>
                setSafetyDistance(value as number)
              }
              min={1}
              max={20}
              step={0.5}
              valueLabelDisplay="auto"
            />
            <Alert severity="info" sx={{ mt: 1 }}>
              Maneuver will raise orbit to maintain minimum {safetyDistance} km separation
            </Alert>
          </Box>
        )}

        {maneuverType === 'station-keeping' && (
          <Alert severity="info">
            Station-keeping will apply small corrections to maintain current orbital parameters
          </Alert>
        )}

        {/* Execution Time */}
        <TextField
          label="Execution Time"
          type="datetime-local"
          value={executionTime.substring(0, 16)}
          onChange={e => setExecutionTime(e.target.value + ':00Z')}
          fullWidth
          InputLabelProps={{ shrink: true }}
        />

        <Divider />

        {/* Analysis Results */}
        {analysis && (
          <Box>
            <Typography variant="h6" gutterBottom>
              Maneuver Analysis
            </Typography>

            {/* Key Metrics */}
            <Stack direction="row" spacing={1} sx={{ mb: 2 }}>
              <Chip
                label={`ΔV: ${analysis.fuelCostDeltaV.toFixed(1)} m/s`}
                color="primary"
                size="small"
              />
              <Chip
                label={`Fuel: ${analysis.fuelCostKg.toFixed(2)} kg`}
                color="primary"
                size="small"
              />
              <Chip
                label={`Risk: ${analysis.collisionProbability.toFixed(1)}%`}
                color={getRiskColor(analysis.collisionProbability) as 'default' | 'primary' | 'secondary' | 'error' | 'info' | 'success' | 'warning'}
                size="small"
              />
            </Stack>

            {/* Orbital Parameters Table */}
            <Paper variant="outlined" sx={{ mb: 2 }}>
              <Table size="small">
                <TableBody>
                  <TableRow>
                    <TableCell>
                      <strong>Parameter</strong>
                    </TableCell>
                    <TableCell align="right">
                      <strong>Current</strong>
                    </TableCell>
                    <TableCell align="right">
                      <strong>Predicted</strong>
                    </TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell>Altitude</TableCell>
                    <TableCell align="right">{satellite.altitude.toFixed(2)} km</TableCell>
                    <TableCell align="right">{analysis.newAltitude.toFixed(2)} km</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell>Velocity</TableCell>
                    <TableCell align="right">{satellite.velocity.toFixed(3)} km/s</TableCell>
                    <TableCell align="right">{analysis.newVelocity.toFixed(3)} km/s</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell>Inclination</TableCell>
                    <TableCell align="right">
                      {satellite.orbitalParams.inclination.toFixed(2)}°
                    </TableCell>
                    <TableCell align="right">
                      {analysis.predictedOrbitalParams.inclination.toFixed(2)}°
                    </TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell>Eccentricity</TableCell>
                    <TableCell align="right">
                      {satellite.orbitalParams.eccentricity.toFixed(4)}
                    </TableCell>
                    <TableCell align="right">
                      {analysis.predictedOrbitalParams.eccentricity.toFixed(4)}
                    </TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell>RAAN</TableCell>
                    <TableCell align="right">{satellite.orbitalParams.raan.toFixed(2)}°</TableCell>
                    <TableCell align="right">
                      {analysis.predictedOrbitalParams.raan.toFixed(2)}°
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </Paper>

            {/* Performance Metrics */}
            <Paper variant="outlined" sx={{ p: 2, mb: 2 }}>
              <Typography variant="subtitle2" gutterBottom>
                Performance Metrics
              </Typography>
              <Stack spacing={1}>
                <Box display="flex" justifyContent="space-between">
                  <Typography variant="body2" color="text.secondary">
                    Execution Duration:
                  </Typography>
                  <Typography variant="body2">
                    {(analysis.executionDuration / 60).toFixed(1)} minutes
                  </Typography>
                </Box>
                <Box display="flex" justifyContent="space-between">
                  <Typography variant="body2" color="text.secondary">
                    Time to Complete:
                  </Typography>
                  <Typography variant="body2">
                    {(analysis.timeToComplete / 60).toFixed(1)} minutes
                  </Typography>
                </Box>
                <Box display="flex" justifyContent="space-between">
                  <Typography variant="body2" color="text.secondary">
                    Collision Probability:
                  </Typography>
                  <Typography variant="body2" color={getRiskColor(analysis.collisionProbability)}>
                    {analysis.collisionProbability.toFixed(2)}%
                  </Typography>
                </Box>
              </Stack>
            </Paper>

            {/* Warning for high risk */}
            {analysis.collisionProbability > 30 && (
              <Alert severity="error" sx={{ mb: 2 }}>
                High collision risk detected! Consider alternative maneuver options.
              </Alert>
            )}
          </Box>
        )}

        <Divider />

        {/* Action Buttons */}
        <Box>
          <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 1.5 }}>
            Actions
          </Typography>
          <Stack spacing={1.5}>
            {/* Primary Actions */}
            <Stack direction="row" spacing={1}>
              <Button
                variant="contained"
                startIcon={<ViewIcon />}
                onClick={handleApplyToView}
                fullWidth
                disabled={!analysis}
                sx={{
                  flexGrow: 1,
                  py: 1.2,
                  boxShadow: 2,
                  '&:hover': { boxShadow: 4 },
                }}
              >
                Apply to View
              </Button>
              <Button
                variant="contained"
                color="success"
                startIcon={<SaveIcon />}
                onClick={handleSaveVariant}
                fullWidth
                disabled={!analysis}
                sx={{
                  flexGrow: 1,
                  py: 1.2,
                  boxShadow: 2,
                  '&:hover': { boxShadow: 4 },
                }}
              >
                Save Variant
              </Button>
            </Stack>

            {/* Secondary Action */}
            <Button
              variant="outlined"
              startIcon={<ResetIcon />}
              onClick={handleReset}
              fullWidth
              sx={{
                borderColor: 'divider',
                color: 'text.secondary',
                '&:hover': {
                  borderColor: 'primary.main',
                  backgroundColor: 'action.hover',
                },
              }}
            >
              Reset Parameters
            </Button>
          </Stack>
        </Box>
      </Stack>
    </Box>
  )
}

export default ManeuverPlanner

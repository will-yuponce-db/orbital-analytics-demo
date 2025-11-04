import React from 'react'
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
} from '@mui/material'
import { TelemetryData } from '../types'

interface MetricsPanelProps {
  satelliteName?: string
  telemetryData?: TelemetryData[]
  highlightedSensors?: string[]
}

const MetricsPanel: React.FC<MetricsPanelProps> = ({
  satelliteName = 'ISS (ZARYA)',
  telemetryData,
  highlightedSensors = [],
}) => {
  // Default telemetry data if none provided
  const defaultTelemetryData: TelemetryData[] = [
    { parameter: 'Altitude', value: '415.2', unit: 'km', status: 'normal' },
    { parameter: 'Velocity', value: '7.66', unit: 'km/s', status: 'normal' },
    { parameter: 'Inclination', value: '51.64', unit: '°', status: 'normal' },
    { parameter: 'Period', value: '92.68', unit: 'min', status: 'normal' },
    { parameter: 'Apogee', value: '421.8', unit: 'km', status: 'normal' },
    { parameter: 'Perigee', value: '408.6', unit: 'km', status: 'normal' },
    { parameter: 'Eccentricity', value: '0.0001', unit: '', status: 'normal' },
    { parameter: 'RAAN', value: '125.4', unit: '°', status: 'normal' },
    { parameter: 'Arg of Perigee', value: '45.2', unit: '°', status: 'normal' },
    { parameter: 'True Anomaly', value: '180.0', unit: '°', status: 'normal' },
    { parameter: 'Solar Panel Voltage', value: '160.5', unit: 'V', status: 'normal' },
    { parameter: 'Battery Charge', value: '98.2', unit: '%', status: 'normal' },
    { parameter: 'Drag Coefficient', value: '2.2', unit: '', status: 'warning' },
  ]

  const displayData = telemetryData || defaultTelemetryData

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

  return (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <Box sx={{ p: 2, borderBottom: 1, borderColor: 'divider' }}>
        <Typography variant="subtitle1" fontWeight={600}>
          Telemetry Data
        </Typography>
        <Typography variant="caption" color="text.secondary">
          {satelliteName}
        </Typography>
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

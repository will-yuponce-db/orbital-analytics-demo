import React, { useState } from 'react'
import {
  Box,
  TextField,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Checkbox,
  Typography,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Divider,
  Chip,
} from '@mui/material'
import { Search as SearchIcon, ExpandMore as ExpandMoreIcon } from '@mui/icons-material'
import { Satellite } from '../types'

interface SatelliteListProps {
  satellites: Satellite[]
  onToggleSatellite?: (satelliteId: string) => void
}

const SatelliteList: React.FC<SatelliteListProps> = ({ satellites, onToggleSatellite }) => {
  const [searchTerm, setSearchTerm] = useState('')

  const filteredSatellites = satellites.filter(
    sat =>
      sat.name.toLowerCase().includes(searchTerm.toLowerCase()) || sat.noradId.includes(searchTerm)
  )

  const groupedSatellites = {
    active: filteredSatellites.filter(s => s.category === 'active'),
    debris: filteredSatellites.filter(s => s.category === 'debris'),
    'rocket-body': filteredSatellites.filter(s => s.category === 'rocket-body'),
  }

  const getCategoryLabel = (category: string) => {
    switch (category) {
      case 'active':
        return 'Active Satellites'
      case 'debris':
        return 'Debris'
      case 'rocket-body':
        return 'Rocket Bodies'
      default:
        return category
    }
  }

  const getCategoryColor = (category: string) => {
    switch (category) {
      case 'active':
        return 'success'
      case 'debris':
        return 'error'
      case 'rocket-body':
        return 'warning'
      default:
        return 'default'
    }
  }

  return (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <Box sx={{ p: 2 }}>
        <TextField
          fullWidth
          size="small"
          placeholder="Search satellites..."
          value={searchTerm}
          onChange={e => setSearchTerm(e.target.value)}
          InputProps={{
            startAdornment: <SearchIcon sx={{ mr: 1, color: 'text.secondary' }} />,
          }}
        />
      </Box>

      <Box sx={{ flexGrow: 1, overflow: 'auto' }}>
        {Object.entries(groupedSatellites).map(([category, sats]) =>
          sats.length > 0 ? (
            <Accordion key={category} defaultExpanded sx={{ backgroundColor: 'background.paper' }}>
              <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, width: '100%' }}>
                  <Typography variant="subtitle2">{getCategoryLabel(category)}</Typography>
                  <Chip
                    label={sats.length}
                    size="small"
                    color={getCategoryColor(category)}
                    sx={{ minWidth: 32 }}
                  />
                </Box>
              </AccordionSummary>
              <AccordionDetails sx={{ p: 0 }}>
                <List dense>
                  {sats.map(satellite => (
                    <React.Fragment key={satellite.id}>
                      <ListItem disablePadding>
                        <ListItemButton onClick={() => onToggleSatellite?.(satellite.id)} dense>
                          <ListItemIcon>
                            <Checkbox
                              edge="start"
                              checked={satellite.selected}
                              tabIndex={-1}
                              disableRipple
                              size="small"
                            />
                          </ListItemIcon>
                          <ListItemText
                            primary={
                              <Box>
                                <Typography variant="body2" noWrap>
                                  {satellite.name}
                                </Typography>
                                <Typography variant="caption" color="text.secondary">
                                  NORAD: {satellite.noradId}
                                </Typography>
                              </Box>
                            }
                          />
                        </ListItemButton>
                      </ListItem>
                      <Box sx={{ px: 2, py: 1, backgroundColor: 'background.default' }}>
                        <Typography variant="caption" color="text.secondary" component="div">
                          Altitude: {satellite.altitude.toFixed(1)} km
                        </Typography>
                        <Typography variant="caption" color="text.secondary" component="div">
                          Velocity: {satellite.velocity.toFixed(2)} km/s
                        </Typography>
                        <Typography variant="caption" color="text.secondary" component="div">
                          Inclination: {satellite.orbitalParams.inclination.toFixed(2)}°
                        </Typography>
                      </Box>
                      <Divider />
                    </React.Fragment>
                  ))}
                </List>
              </AccordionDetails>
            </Accordion>
          ) : null
        )}
      </Box>
    </Box>
  )
}

export default SatelliteList

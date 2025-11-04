import React, { useState, useEffect } from 'react'
import { useSearchParams, Link as RouterLink } from 'react-router-dom'
import {
  Container,
  Box,
  Typography,
  Grid,
  FormControl,
  Select,
  MenuItem,
  InputLabel,
  TextField,
  Stack,
  Chip,
  Paper,
  Link,
} from '@mui/material'
import { Search as SearchIcon, History as HistoryIcon } from '@mui/icons-material'
import { mockScenarios } from '../data/scenarios'
import ScenarioCard from '../components/ScenarioCard'
import { DataQuality } from '../types'
import { getRecentlyViewed, getRelativeTime } from '../utils/recentlyViewed'

const ScenarioDashboard: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams()

  // Initialize state from URL parameters
  const [searchTerm, setSearchTerm] = useState(searchParams.get('search') || '')
  const [dataQualityFilter, setDataQualityFilter] = useState<DataQuality | 'all'>(
    (searchParams.get('quality') as DataQuality) || 'all'
  )

  // Update URL when filters change
  useEffect(() => {
    const params = new URLSearchParams()
    if (searchTerm) params.set('search', searchTerm)
    if (dataQualityFilter !== 'all') params.set('quality', dataQualityFilter)
    setSearchParams(params, { replace: true })
  }, [searchTerm, dataQualityFilter, setSearchParams])

  const filteredScenarios = mockScenarios.filter(scenario => {
    const matchesSearch =
      scenario.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      scenario.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
      scenario.tags.some(tag => tag.toLowerCase().includes(searchTerm.toLowerCase()))

    const matchesQuality = dataQualityFilter === 'all' || scenario.dataQuality === dataQualityFilter

    return matchesSearch && matchesQuality
  })

  const getCountByQuality = (quality: DataQuality) => {
    return mockScenarios.filter(s => s.dataQuality === quality).length
  }

  // Keyboard shortcuts
  const searchInputRef = React.useRef<HTMLInputElement>(null)

  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      // Ctrl/Cmd + K to focus search
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault()
        searchInputRef.current?.focus()
      }
    }

    window.addEventListener('keydown', handleKeyPress)
    return () => window.removeEventListener('keydown', handleKeyPress)
  }, [])

  const recentlyViewed = getRecentlyViewed()

  return (
    <Container maxWidth="xl">
      <Box sx={{ my: 4 }}>
        {/* Header */}
        <Box sx={{ mb: 4 }}>
          <Stack direction="row" spacing={2} alignItems="center" sx={{ mb: 2 }}>
            <Typography variant="h3" component="h1" fontWeight={600}>
              Training Scenario Library
            </Typography>
            <Chip label="Quick Access Mode" color="primary" sx={{ fontWeight: 'bold' }} />
          </Stack>
          <Typography variant="body1" color="text.secondary">
            Instant access to all training scenarios for testing, certification, and operator
            familiarization. No prerequisites required - select any scenario to begin analysis.
          </Typography>
        </Box>

        {/* Recently Viewed */}
        {recentlyViewed.length > 0 && (
          <Paper elevation={1} sx={{ p: 2, mb: 3, backgroundColor: 'background.paper' }}>
            <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1.5 }}>
              <HistoryIcon sx={{ color: 'text.secondary', fontSize: 20 }} />
              <Typography variant="subtitle2" fontWeight={600}>
                Recently Viewed
              </Typography>
            </Stack>
            <Stack direction="row" spacing={2} flexWrap="wrap" useFlexGap>
              {recentlyViewed.map(item => (
                <Link
                  key={item.scenarioId}
                  component={RouterLink}
                  to={`/scenario/${item.scenarioId}`}
                  sx={{
                    textDecoration: 'none',
                    '&:hover': { textDecoration: 'underline' },
                  }}
                >
                  <Chip
                    label={`${item.scenarioName} • ${getRelativeTime(item.timestamp)}`}
                    size="small"
                    variant="outlined"
                    sx={{
                      cursor: 'pointer',
                      '&:hover': {
                        backgroundColor: 'action.hover',
                        borderColor: 'primary.main',
                      },
                    }}
                  />
                </Link>
              ))}
            </Stack>
          </Paper>
        )}

        {/* Stats Overview */}
        <Paper elevation={2} sx={{ p: 3, mb: 4 }}>
          <Stack direction="row" spacing={3} flexWrap="wrap">
            <Box>
              <Typography variant="h4" fontWeight={600}>
                {mockScenarios.length}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Total Scenarios
              </Typography>
            </Box>
            <Box>
              <Typography variant="h4" fontWeight={600} color="testing.main">
                {getCountByQuality('testing')}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Testing
              </Typography>
            </Box>
            <Box>
              <Typography variant="h4" fontWeight={600} color="training.main">
                {getCountByQuality('training')}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Training
              </Typography>
            </Box>
            <Box>
              <Typography variant="h4" fontWeight={600} color="operational.main">
                {getCountByQuality('operational')}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Operational
              </Typography>
            </Box>
          </Stack>
        </Paper>

        {/* Filters */}
        <Paper elevation={1} sx={{ p: 2, mb: 3 }}>
          <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
            <TextField
              fullWidth
              size="small"
              placeholder="Search scenarios... (Ctrl/Cmd + K)"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              inputRef={searchInputRef}
              InputProps={{
                startAdornment: <SearchIcon sx={{ mr: 1, color: 'text.secondary' }} />,
              }}
            />
            <FormControl size="small" sx={{ minWidth: 200 }}>
              <InputLabel>Data Quality</InputLabel>
              <Select
                value={dataQualityFilter}
                label="Data Quality"
                onChange={e => setDataQualityFilter(e.target.value as DataQuality | 'all')}
              >
                <MenuItem value="all">All Types</MenuItem>
                <MenuItem value="testing">Testing</MenuItem>
                <MenuItem value="training">Training</MenuItem>
                <MenuItem value="operational">Operational</MenuItem>
              </Select>
            </FormControl>
          </Stack>
        </Paper>

        {/* Results count */}
        <Box sx={{ mb: 2 }}>
          <Typography variant="body2" color="text.secondary">
            Showing {filteredScenarios.length} scenario{filteredScenarios.length !== 1 ? 's' : ''}
          </Typography>
        </Box>

        {/* Scenario Grid */}
        {filteredScenarios.length > 0 ? (
          <Grid container spacing={3}>
            {filteredScenarios.map(scenario => (
              <Grid item xs={12} sm={6} md={4} key={scenario.id}>
                <ScenarioCard scenario={scenario} />
              </Grid>
            ))}
          </Grid>
        ) : (
          <Paper
            elevation={1}
            sx={{
              p: 6,
              textAlign: 'center',
              backgroundColor: 'background.paper',
            }}
          >
            <Typography variant="h6" color="text.secondary" gutterBottom>
              No scenarios found
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Try adjusting your search or filters
            </Typography>
          </Paper>
        )}
      </Box>
    </Container>
  )
}

export default ScenarioDashboard

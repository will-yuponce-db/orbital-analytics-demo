import React from 'react'
import { useNavigate } from 'react-router-dom'
import { Container, Box, Typography, Grid, Button, Stack, Paper } from '@mui/material'
import { PlayArrow as PlayIcon, Satellite as SatelliteIcon } from '@mui/icons-material'

const Home: React.FC = () => {
  const navigate = useNavigate()

  return (
    <Container maxWidth="lg">
      <Box sx={{ my: 6 }}>
        {/* Hero Section */}
        <Paper
          elevation={0}
          sx={{
            p: 6,
            mb: 6,
            textAlign: 'center',
            background: 'linear-gradient(135deg, #1e3a5f 0%, #2d5a8c 100%)',
            color: 'white',
          }}
        >
          <SatelliteIcon sx={{ fontSize: 64, mb: 2, opacity: 0.9 }} />
          <Typography variant="h2" fontWeight={700} gutterBottom>
            USSF Space Operations Training Platform
          </Typography>
          <Typography variant="h5" sx={{ opacity: 0.9, mb: 4 }}>
            Testing & Training Infrastructure for Space Domain Awareness
          </Typography>
          <Button
            variant="contained"
            size="large"
            startIcon={<PlayIcon />}
            onClick={() => navigate('/scenarios')}
            sx={{
              px: 6,
              py: 2,
              fontSize: '1.1rem',
              backgroundColor: 'white',
              color: 'primary.main',
              '&:hover': {
                backgroundColor: 'rgba(255,255,255,0.9)',
              },
            }}
          >
            Enter Scenario Library
          </Button>
        </Paper>

        {/* Key Use Cases */}
        <Paper elevation={2} sx={{ p: 4, mb: 4 }}>
          <Typography variant="h5" fontWeight={600} gutterBottom sx={{ mb: 3 }}>
            Platform Use Cases
          </Typography>
          <Grid container spacing={3}>
            <Grid item xs={12} md={6}>
              <Stack spacing={1}>
                <Typography variant="h6" color="primary.main" fontWeight={600}>
                  ✓ SPOC Operator Testing & Certification
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Validate operator proficiency with realistic conjunction assessment, threat
                  detection, and decision-making scenarios.
                </Typography>
              </Stack>
            </Grid>
            <Grid item xs={12} md={6}>
              <Stack spacing={1}>
                <Typography variant="h6" color="primary.main" fontWeight={600}>
                  ✓ Infrastructure Validation
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Test system integration with SSN feeds, AI recommendations, and C2 alert
                  workflows.
                </Typography>
              </Stack>
            </Grid>
            <Grid item xs={12} md={6}>
              <Stack spacing={1}>
                <Typography variant="h6" color="primary.main" fontWeight={600}>
                  ✓ Threat Response Training
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Practice identifying and responding to ASAT weapons, co-orbital threats, and
                  electronic warfare attacks.
                </Typography>
              </Stack>
            </Grid>
            <Grid item xs={12} md={6}>
              <Stack spacing={1}>
                <Typography variant="h6" color="primary.main" fontWeight={600}>
                  ✓ Quick Scenario Analysis
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Instant access to all scenarios with search, filtering, and recently viewed
                  tracking.
                </Typography>
              </Stack>
            </Grid>
          </Grid>
        </Paper>

        {/* Platform Features */}
        <Paper elevation={2} sx={{ p: 4, mt: 6 }}>
          <Typography variant="h5" fontWeight={600} gutterBottom>
            Training Platform Capabilities
          </Typography>
          <Grid container spacing={3} sx={{ mt: 1 }}>
            <Grid item xs={12} md={4}>
              <Stack spacing={1}>
                <Typography variant="h6" color="primary">
                  🛰️ Real-Time Analysis
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  3D orbital visualization, conjunction analysis, and threat assessment tools
                  matching operational systems.
                </Typography>
              </Stack>
            </Grid>
            <Grid item xs={12} md={4}>
              <Stack spacing={1}>
                <Typography variant="h6" color="primary">
                  🤖 AI Decision Support
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Digital twin recommendations, collision avoidance planning, and automated anomaly
                  detection for training.
                </Typography>
              </Stack>
            </Grid>
            <Grid item xs={12} md={4}>
              <Stack spacing={1}>
                <Typography variant="h6" color="primary">
                  ⚔️ Threat Scenarios
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  ASAT weapons, electronic warfare, proximity operations, and multi-domain
                  counter-space operations.
                </Typography>
              </Stack>
            </Grid>
            <Grid item xs={12} md={4}>
              <Stack spacing={1}>
                <Typography variant="h6" color="primary">
                  📊 SSN Integration
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Simulated feeds from Space Fence, PAVE PAWS, GEODSS, and other Space Surveillance
                  Network sensors.
                </Typography>
              </Stack>
            </Grid>
            <Grid item xs={12} md={4}>
              <Stack spacing={1}>
                <Typography variant="h6" color="primary">
                  🔐 Classification Training
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Practice with DoD classification markings, RBAC controls, and need-to-know
                  principles.
                </Typography>
              </Stack>
            </Grid>
            <Grid item xs={12} md={4}>
              <Stack spacing={1}>
                <Typography variant="h6" color="primary">
                  🚨 C2 Alert Workflows
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  FLASH/IMMEDIATE priority alerts, dissemination protocols, and multi-level
                  acknowledgment training.
                </Typography>
              </Stack>
            </Grid>
          </Grid>
        </Paper>

        {/* Quick Stats */}
        <Paper
          elevation={1}
          sx={{
            p: 3,
            mt: 4,
            backgroundColor: 'background.default',
            borderLeft: 4,
            borderColor: 'primary.main',
          }}
        >
          <Grid container spacing={3} alignItems="center">
            <Grid item xs={6} sm={3}>
              <Box textAlign="center">
                <Typography variant="h3" fontWeight={700} color="primary.main">
                  6
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  Training Scenarios
                </Typography>
              </Box>
            </Grid>
            <Grid item xs={6} sm={3}>
              <Box textAlign="center">
                <Typography variant="h3" fontWeight={700} color="success.main">
                  3
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  Data Quality Levels
                </Typography>
              </Box>
            </Grid>
            <Grid item xs={6} sm={3}>
              <Box textAlign="center">
                <Typography variant="h3" fontWeight={700} color="warning.main">
                  5
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  Threat Categories
                </Typography>
              </Box>
            </Grid>
            <Grid item xs={6} sm={3}>
              <Box textAlign="center">
                <Typography variant="h3" fontWeight={700} color="info.main">
                  9
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  SSN Sensors Simulated
                </Typography>
              </Box>
            </Grid>
          </Grid>
        </Paper>

        {/* Footer Note */}
        <Box sx={{ mt: 4, textAlign: 'center' }}>
          <Typography variant="body2" color="text.secondary" fontWeight={500}>
            UNCLASSIFIED TRAINING PLATFORM
          </Typography>
          <Typography variant="caption" color="text.secondary">
            Simulated data only • Not connected to operational systems • For testing and training
            purposes
          </Typography>
        </Box>
      </Box>
    </Container>
  )
}

export default Home

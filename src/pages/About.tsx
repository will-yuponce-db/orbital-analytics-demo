import React from 'react'
import {
  Typography,
  Container,
  Paper,
  Box,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Divider,
  Stack,
} from '@mui/material'
import {
  Satellite as SatelliteIcon,
  CheckCircle as CheckCircleIcon,
  Security as SecurityIcon,
} from '@mui/icons-material'

const About: React.FC = () => {
  const features = [
    'Scenario-based orbital analysis workflow',
    '3D visualization of satellite orbits and trajectories',
    'AI-powered digital twin recommendations',
    'Real-time telemetry and metrics monitoring',
    'Multi-satellite tracking and conjunction analysis',
    'Support for testing, training, and operational data',
  ]

  const technologies = [
    'React 18 with TypeScript - Type-safe UI development',
    'Vite - Lightning-fast build tooling',
    'Material-UI (MUI) - Comprehensive component library',
    'React Router - Client-side navigation',
    'Dark space theme optimized for data visualization',
  ]

  return (
    <Container maxWidth="lg">
      <Box sx={{ my: 4 }}>
        <Stack direction="row" spacing={2} alignItems="center" sx={{ mb: 2 }}>
          <SatelliteIcon sx={{ fontSize: 48, color: 'primary.main' }} />
          <Box>
            <Typography variant="h3" component="h1" fontWeight={600}>
              Orbital Analysis Platform
            </Typography>
            <Typography variant="h6" color="text.secondary">
              Space Domain Awareness & AI Digital Twins
            </Typography>
          </Box>
        </Stack>

        <Paper elevation={3} sx={{ p: 4, mt: 4 }}>
          <Typography variant="h5" gutterBottom fontWeight={600}>
            Overview
          </Typography>
          <Typography variant="body1" paragraph>
            The Orbital Analysis Platform is a comprehensive tool designed for orbital analysts
            working in the space domain. This application enables you to view, analyze, and manage
            orbital scenarios with AI-powered digital twin insights.
          </Typography>
          <Typography variant="body1" paragraph>
            Whether you&apos;re working with testing data, training models, or analyzing operational
            scenarios, this platform provides the tools you need to make informed decisions about
            satellite behavior, conjunction risks, and orbital dynamics.
          </Typography>
        </Paper>

        <Paper elevation={3} sx={{ p: 4, mt: 4 }}>
          <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 2 }}>
            <SecurityIcon color="primary" />
            <Typography variant="h5" fontWeight={600}>
              Key Features
            </Typography>
          </Stack>
          <List>
            {features.map((feature, index) => (
              <React.Fragment key={feature}>
                <ListItem>
                  <ListItemIcon>
                    <CheckCircleIcon color="primary" />
                  </ListItemIcon>
                  <ListItemText primary={feature} />
                </ListItem>
                {index < features.length - 1 && <Divider />}
              </React.Fragment>
            ))}
          </List>
        </Paper>

        <Paper elevation={3} sx={{ p: 4, mt: 4 }}>
          <Typography variant="h5" gutterBottom fontWeight={600}>
            Data Quality Types
          </Typography>
          <Stack spacing={3} sx={{ mt: 2 }}>
            <Box>
              <Typography variant="h6" sx={{ color: 'testing.main', fontWeight: 600 }} gutterBottom>
                Testing Data
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Scenarios used for testing and validating prediction algorithms, collision detection
                systems, and other analytical tools. These scenarios often include historical data
                with known outcomes.
              </Typography>
            </Box>
            <Divider />
            <Box>
              <Typography
                variant="h6"
                sx={{ color: 'training.main', fontWeight: 600 }}
                gutterBottom
              >
                Training Data
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Data sets used to train machine learning models and AI digital twins. These
                scenarios help improve the accuracy and reliability of automated decision-making
                systems.
              </Typography>
            </Box>
            <Divider />
            <Box>
              <Typography
                variant="h6"
                sx={{ color: 'operational.main', fontWeight: 600 }}
                gutterBottom
              >
                Operational Data
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Real-time or near-real-time scenarios representing actual satellite operations.
                These scenarios require immediate attention and inform critical operational
                decisions.
              </Typography>
            </Box>
          </Stack>
        </Paper>

        <Paper elevation={3} sx={{ p: 4, mt: 4 }}>
          <Typography variant="h5" gutterBottom fontWeight={600}>
            Technologies
          </Typography>
          <List>
            {technologies.map((tech, index) => (
              <React.Fragment key={tech}>
                <ListItem>
                  <ListItemIcon>
                    <CheckCircleIcon color="primary" />
                  </ListItemIcon>
                  <ListItemText primary={tech} />
                </ListItem>
                {index < technologies.length - 1 && <Divider />}
              </React.Fragment>
            ))}
          </List>
        </Paper>

        <Paper elevation={3} sx={{ p: 4, mt: 4 }}>
          <Typography variant="h5" gutterBottom fontWeight={600}>
            Getting Started
          </Typography>
          <List>
            <ListItem>
              <ListItemText
                primary="1. Browse Scenarios"
                secondary="Start from the Scenarios dashboard to view your collection of orbital analysis scenarios"
              />
            </ListItem>
            <ListItem>
              <ListItemText
                primary="2. Select a Scenario"
                secondary="Click on any scenario card to open the detailed analysis view"
              />
            </ListItem>
            <ListItem>
              <ListItemText
                primary="3. Analyze Data"
                secondary="Use the 3D visualization, satellite list, metrics, and AI recommendations to perform your analysis"
              />
            </ListItem>
            <ListItem>
              <ListItemText
                primary="4. Review AI Insights"
                secondary="Check the AI Twin panel for automated recommendations and decision support"
              />
            </ListItem>
          </List>
        </Paper>
      </Box>
    </Container>
  )
}

export default About

import React from 'react'
import { Link, useLocation } from 'react-router-dom'
import { AppBar, Box, CssBaseline, Toolbar, Typography, Stack, Chip, Button, Theme } from '@mui/material'
import SatelliteAltIcon from '@mui/icons-material/SatelliteAlt'
import HomeIcon from '@mui/icons-material/Home'
import DashboardIcon from '@mui/icons-material/Dashboard'
import InfoIcon from '@mui/icons-material/Info'
import ClassificationBanner from './ClassificationBanner'
import UserProfileBadge from './UserProfileBadge'
import { classificationUnclassified, mockUsers } from '../data/scenarios'

interface LayoutProps {
  children: React.ReactNode
}

const Layout: React.FC<LayoutProps> = ({ children }) => {
  const location = useLocation()
  // Use first user as current user (in real app, this would come from auth context)
  const currentUser = mockUsers[0]

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
      <CssBaseline />

      {/* Top Classification Banner */}
      <ClassificationBanner classification={classificationUnclassified} position="top" />

      <AppBar
        position="fixed"
        sx={{
          top: 32, // Offset for classification banner
          zIndex: (theme: Theme) => theme.zIndex.drawer + 1,
        }}
      >
        <Toolbar>
          <SatelliteAltIcon sx={{ mr: 1.5, fontSize: 32 }} />
          <Typography variant="h6" noWrap component="div" sx={{ flexGrow: 1, fontWeight: 600 }}>
            USSF Space Domain Awareness Platform
          </Typography>

          {/* Navigation Buttons */}
          <Stack direction="row" spacing={1} sx={{ mr: 2, display: { xs: 'none', sm: 'flex' } }}>
            <Button
              component={Link}
              to="/"
              startIcon={<HomeIcon />}
              color="inherit"
              variant={location.pathname === '/' ? 'outlined' : 'text'}
              sx={{ borderColor: location.pathname === '/' ? 'white' : 'transparent' }}
            >
              Home
            </Button>
            <Button
              component={Link}
              to="/scenarios"
              startIcon={<DashboardIcon />}
              color="inherit"
              variant={location.pathname === '/scenarios' ? 'outlined' : 'text'}
              sx={{ borderColor: location.pathname === '/scenarios' ? 'white' : 'transparent' }}
            >
              Scenarios
            </Button>
            <Button
              component={Link}
              to="/about"
              startIcon={<InfoIcon />}
              color="inherit"
              variant={location.pathname === '/about' ? 'outlined' : 'text'}
              sx={{ borderColor: location.pathname === '/about' ? 'white' : 'transparent' }}
            >
              About
            </Button>
          </Stack>

          {/* System Status Indicators */}
          <Stack direction="row" spacing={1} sx={{ mr: 2, display: { xs: 'none', md: 'flex' } }}>
            <Chip
              label="SSN CONNECTED"
              size="small"
              color="success"
              sx={{ fontWeight: 'bold', fontSize: '0.7rem' }}
            />
            <Chip
              label="JSpOC LINK"
              size="small"
              color="info"
              sx={{ fontWeight: 'bold', fontSize: '0.7rem' }}
            />
          </Stack>

          {/* User Profile */}
          <UserProfileBadge user={currentUser} />
        </Toolbar>
      </AppBar>

      <Box
        component="main"
        sx={{
          flexGrow: 1,
          width: '100%',
          backgroundColor: 'background.default',
          paddingTop: '96px', // Space for classification banner + AppBar
          paddingBottom: '32px', // Space for bottom banner
        }}
      >
        {children}
      </Box>

      {/* Bottom Classification Banner */}
      <ClassificationBanner classification={classificationUnclassified} position="bottom" />
    </Box>
  )
}

export default Layout

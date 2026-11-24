import React, { Suspense, lazy } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { Box, CircularProgress } from '@mui/material'
import Layout from './components/Layout'
import Home from './pages/Home'
import ScenarioDashboard from './pages/ScenarioDashboard'
import About from './pages/About'
import AlertFAB from './components/AlertFAB'

// The event view carries three.js and the charts; load it on demand.
const ScenarioDetailView = lazy(() => import('./pages/ScenarioDetailView'))

const RouteFallback: React.FC = () => (
  <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '50vh' }}>
    <CircularProgress />
  </Box>
)

const App: React.FC = () => {
  return (
    <Layout>
      <AlertFAB />
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/scenarios" element={<ScenarioDashboard />} />
        <Route
          path="/scenario/:scenarioId"
          element={
            <Suspense fallback={<RouteFallback />}>
              <ScenarioDetailView />
            </Suspense>
          }
        />
        <Route path="/about" element={<About />} />
        {/* Old campaign route and unknown routes go to the scenario library */}
        <Route path="/campaign" element={<Navigate to="/scenarios" replace />} />
        <Route path="*" element={<Navigate to="/scenarios" replace />} />
      </Routes>
    </Layout>
  )
}

export default App

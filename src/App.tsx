import React from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import Layout from './components/Layout'
import Home from './pages/Home'
import ScenarioDashboard from './pages/ScenarioDashboard'
import ScenarioDetailView from './pages/ScenarioDetailView'
import About from './pages/About'

const App: React.FC = () => {
  return (
    <Layout>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/scenarios" element={<ScenarioDashboard />} />
        <Route path="/scenario/:scenarioId" element={<ScenarioDetailView />} />
        <Route path="/about" element={<About />} />
        {/* Redirect old campaign route and any unknown routes to scenarios */}
        <Route path="/campaign" element={<Navigate to="/scenarios" replace />} />
        <Route path="*" element={<Navigate to="/scenarios" replace />} />
      </Routes>
    </Layout>
  )
}

export default App

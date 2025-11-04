import React, { useRef, useState } from 'react'
import { Box, Paper, IconButton, Stack, Tooltip } from '@mui/material'
import {
  Layers as LayersIcon,
  ThreeDRotation as RotateIcon,
  ZoomIn as ZoomInIcon,
  ZoomOut as ZoomOutIcon,
  CenterFocusStrong as CenterIcon,
} from '@mui/icons-material'
import { Canvas } from '@react-three/fiber'
import Scene from './3d/Scene'
import { Satellite, ManeuverAnalysis } from '../types'

interface Visualization3DProps {
  satellites: Satellite[]
  currentTime: Date
  onSatelliteClick?: (satellite: Satellite) => void
  maneuverAnalysis?: ManeuverAnalysis | null
}

const Visualization3D: React.FC<Visualization3DProps> = ({
  satellites,
  currentTime,
  onSatelliteClick,
  maneuverAnalysis,
}) => {
  const controlsRef = useRef<unknown>(null)
  const [autoRotate, setAutoRotate] = useState(false)
  const [showLayers, setShowLayers] = useState(true)

  const handleZoomIn = () => {
    if (controlsRef.current) {
      const controls = controlsRef.current
      controls.dollyIn(1.2)
      controls.update()
    }
  }

  const handleZoomOut = () => {
    if (controlsRef.current) {
      const controls = controlsRef.current
      controls.dollyOut(1.2)
      controls.update()
    }
  }

  const handleResetCamera = () => {
    if (controlsRef.current) {
      const controls = controlsRef.current
      controls.reset()
    }
  }

  const handleToggleRotate = () => {
    setAutoRotate(!autoRotate)
    if (controlsRef.current) {
      controlsRef.current.autoRotate = !autoRotate
    }
  }

  const handleToggleLayers = () => {
    setShowLayers(!showLayers)
  }

  return (
    <Paper
      elevation={2}
      sx={{
        position: 'relative',
        height: '100%',
        backgroundColor: '#000814',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}
    >
      {/* Camera controls overlay */}
      <Box
        sx={{
          position: 'absolute',
          top: 16,
          right: 16,
          zIndex: 10,
          backgroundColor: 'background.paper',
          borderRadius: 1,
          p: 1,
        }}
      >
        <Stack spacing={1}>
          <Tooltip title="Zoom In" placement="left">
            <IconButton size="small" onClick={handleZoomIn}>
              <ZoomInIcon fontSize="small" />
            </IconButton>
          </Tooltip>
          <Tooltip title="Zoom Out" placement="left">
            <IconButton size="small" onClick={handleZoomOut}>
              <ZoomOutIcon fontSize="small" />
            </IconButton>
          </Tooltip>
          <Tooltip title="Reset Camera" placement="left">
            <IconButton size="small" onClick={handleResetCamera}>
              <CenterIcon fontSize="small" />
            </IconButton>
          </Tooltip>
          <Tooltip title={autoRotate ? 'Stop Rotation' : 'Auto Rotate'} placement="left">
            <IconButton
              size="small"
              onClick={handleToggleRotate}
              color={autoRotate ? 'primary' : 'default'}
            >
              <RotateIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        </Stack>
      </Box>

      {/* Layer controls */}
      <Box
        sx={{
          position: 'absolute',
          top: 16,
          left: 16,
          zIndex: 10,
          backgroundColor: 'background.paper',
          borderRadius: 1,
          p: 1,
        }}
      >
        <Stack direction="row" spacing={1}>
          <Tooltip title="Toggle Layers">
            <IconButton
              size="small"
              onClick={handleToggleLayers}
              color={showLayers ? 'primary' : 'default'}
            >
              <LayersIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        </Stack>
      </Box>

      {/* 3D Visualization Canvas */}
      <Box
        sx={{
          flexGrow: 1,
          position: 'relative',
        }}
      >
        <Canvas camera={{ position: [20, 15, 20], fov: 60 }} style={{ background: '#000814' }}>
          <Scene
            satellites={satellites}
            currentTime={currentTime}
            onSatelliteClick={onSatelliteClick}
            controlsRef={controlsRef}
            maneuverAnalysis={maneuverAnalysis}
          />
        </Canvas>
      </Box>
    </Paper>
  )
}

export default Visualization3D

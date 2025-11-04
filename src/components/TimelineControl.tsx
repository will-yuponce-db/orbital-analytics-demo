import React, { useState, useEffect, useRef, useMemo } from 'react'
import {
  Box,
  Paper,
  IconButton,
  Slider,
  Typography,
  Select,
  MenuItem,
  FormControl,
  Tooltip,
} from '@mui/material'
import {
  PlayArrow as PlayIcon,
  Pause as PauseIcon,
  SkipNext as SkipNextIcon,
  SkipPrevious as SkipPreviousIcon,
  Speed as SpeedIcon,
} from '@mui/icons-material'

interface TimelineControlProps {
  startTime: string
  endTime: string
  currentTime: Date
  onTimeChange: (time: Date) => void
}

const TimelineControl: React.FC<TimelineControlProps> = ({
  startTime,
  endTime,
  currentTime,
  onTimeChange,
}) => {
  const [isPlaying, setIsPlaying] = useState(false)
  const [speed, setSpeed] = useState(1)
  const animationFrameRef = useRef<number>()
  const lastUpdateRef = useRef<number>(0)
  const currentTimeRef = useRef<Date>(currentTime)

  // Initialize lastUpdateRef on mount
  useEffect(() => {
    if (lastUpdateRef.current === 0) {
      lastUpdateRef.current = Date.now()
    }
  }, [])

  // Memoize date objects to prevent unnecessary re-renders
  const startDate = useMemo(() => new Date(startTime), [startTime])
  const endDate = useMemo(() => new Date(endTime), [endTime])
  const totalDuration = endDate.getTime() - startDate.getTime()

  // Keep ref in sync with prop
  useEffect(() => {
    currentTimeRef.current = currentTime
  }, [currentTime])

  // Calculate slider value from current time
  const sliderValue = ((currentTime.getTime() - startDate.getTime()) / totalDuration) * 100

  // Animation loop for playing timeline
  useEffect(() => {
    if (isPlaying) {
      const animate = () => {
        const now = Date.now()
        const deltaTime = (now - lastUpdateRef.current) * speed * 10 // Scale speed for better control
        lastUpdateRef.current = now

        const newTime = new Date(currentTimeRef.current.getTime() + deltaTime)

        // Loop back to start if we reach the end
        if (newTime.getTime() >= endDate.getTime()) {
          onTimeChange(startDate)
          currentTimeRef.current = startDate
        } else {
          onTimeChange(newTime)
          currentTimeRef.current = newTime
        }

        animationFrameRef.current = requestAnimationFrame(animate)
      }

      lastUpdateRef.current = Date.now()
      animationFrameRef.current = requestAnimationFrame(animate)

      return () => {
        if (animationFrameRef.current) {
          cancelAnimationFrame(animationFrameRef.current)
        }
      }
    }
  }, [isPlaying, speed, startDate, endDate, onTimeChange])

  const handlePlayPause = () => {
    setIsPlaying(!isPlaying)
  }

  const handlePreviousEvent = () => {
    // Jump back 1 minute
    const newTime = new Date(currentTime.getTime() - 60000)
    if (newTime.getTime() < startDate.getTime()) {
      onTimeChange(startDate)
    } else {
      onTimeChange(newTime)
    }
    setIsPlaying(false)
  }

  const handleNextEvent = () => {
    // Jump forward 1 minute
    const newTime = new Date(currentTime.getTime() + 60000)
    if (newTime.getTime() > endDate.getTime()) {
      onTimeChange(endDate)
    } else {
      onTimeChange(newTime)
    }
    setIsPlaying(false)
  }

  const handleSliderChange = (_: Event, value: number | number[]) => {
    const percentage = (value as number) / 100
    const newTime = new Date(startDate.getTime() + totalDuration * percentage)
    // Pause playback when manually adjusting
    setIsPlaying(false)
    onTimeChange(newTime)
  }

  const formatTime = (time: string | Date) => {
    const date = typeof time === 'string' ? new Date(time) : time
    return date.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    })
  }

  return (
    <Paper
      elevation={3}
      sx={{
        p: 2,
        backgroundColor: 'background.paper',
        borderTop: '1px solid',
        borderColor: 'divider',
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
        {/* Playback controls */}
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Tooltip title="Previous event (1 min back)">
            <IconButton size="small" onClick={handlePreviousEvent}>
              <SkipPreviousIcon />
            </IconButton>
          </Tooltip>
          <Tooltip title={isPlaying ? 'Pause' : 'Play'}>
            <IconButton size="small" onClick={handlePlayPause} color="primary">
              {isPlaying ? <PauseIcon /> : <PlayIcon />}
            </IconButton>
          </Tooltip>
          <Tooltip title="Next event (1 min forward)">
            <IconButton size="small" onClick={handleNextEvent}>
              <SkipNextIcon />
            </IconButton>
          </Tooltip>
        </Box>

        {/* Timeline slider */}
        <Box sx={{ flexGrow: 1, px: 2 }}>
          <Slider
            value={sliderValue}
            onChange={handleSliderChange}
            sx={{
              '& .MuiSlider-markLabel': {
                fontSize: '0.7rem',
              },
            }}
          />
          <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 0.5 }}>
            <Typography variant="caption" color="text.secondary">
              {formatTime(startTime)}
            </Typography>
            <Typography variant="caption" color="primary.main" fontWeight={600}>
              {formatTime(currentTime)}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {formatTime(endTime)}
            </Typography>
          </Box>
        </Box>

        {/* Speed control */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, minWidth: 120 }}>
          <SpeedIcon sx={{ fontSize: 20, color: 'text.secondary' }} />
          <FormControl size="small" sx={{ minWidth: 80 }}>
            <Select
              value={speed}
              onChange={e => setSpeed(e.target.value as number)}
              sx={{ fontSize: '0.875rem' }}
            >
              <MenuItem value={0.25}>0.25x</MenuItem>
              <MenuItem value={0.5}>0.5x</MenuItem>
              <MenuItem value={1}>1x</MenuItem>
              <MenuItem value={2}>2x</MenuItem>
              <MenuItem value={5}>5x</MenuItem>
              <MenuItem value={10}>10x</MenuItem>
            </Select>
          </FormControl>
        </Box>
      </Box>
    </Paper>
  )
}

export default TimelineControl

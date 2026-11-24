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
import useNow from '../hooks/useNow'
import { formatUtc } from '../utils/format'

/** Playback rates in simulated seconds per real second. */
const SPEEDS = [
  { value: 10, label: '10\u00d7' },
  { value: 60, label: '1 min/s' },
  { value: 300, label: '5 min/s' },
  { value: 900, label: '15 min/s' },
  { value: 3600, label: '1 h/s' },
]

export interface TimelineMarker {
  time: string // ISO timestamp
  label: string
  color: string // hex color
  type: 'conjunction' | 'anomaly'
}

interface TimelineControlProps {
  startTime: string
  endTime: string
  currentTime: Date
  onTimeChange: (time: Date) => void
  markers?: TimelineMarker[]
}

const TimelineControl: React.FC<TimelineControlProps> = ({
  startTime,
  endTime,
  currentTime,
  onTimeChange,
  markers = [],
}) => {
  const [isPlaying, setIsPlaying] = useState(false)
  const [speed, setSpeed] = useState(60)
  const nowMs = useNow(10_000)
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
        const deltaTime = (now - lastUpdateRef.current) * speed
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
    // If at the end, restart from beginning before playing
    if (!isPlaying && currentTime.getTime() >= endDate.getTime() - 1000) {
      onTimeChange(startDate)
      currentTimeRef.current = startDate
    }
    setIsPlaying(!isPlaying)
  }

  // Sort markers by time for event-based navigation
  const sortedMarkerTimes = useMemo(
    () =>
      markers
        .map(m => new Date(m.time).getTime())
        .filter(t => t >= startDate.getTime() && t <= endDate.getTime())
        .sort((a, b) => a - b),
    [markers, startDate, endDate]
  )

  const handlePreviousEvent = () => {
    // Jump to previous event marker, or back 1 minute if no markers
    const now = currentTime.getTime()
    const prev = sortedMarkerTimes.filter(t => t < now - 1000).pop()
    if (prev !== undefined) {
      onTimeChange(new Date(prev))
    } else {
      const newTime = new Date(now - 60000)
      onTimeChange(newTime.getTime() < startDate.getTime() ? startDate : newTime)
    }
    setIsPlaying(false)
  }

  const handleNextEvent = () => {
    // Jump to next event marker, or forward 1 minute if no markers
    const now = currentTime.getTime()
    const next = sortedMarkerTimes.find(t => t > now + 1000)
    if (next !== undefined) {
      onTimeChange(new Date(next))
    } else {
      const newTime = new Date(now + 60000)
      onTimeChange(newTime.getTime() > endDate.getTime() ? endDate : newTime)
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

  const formatTime = (time: string | Date) => formatUtc(time, { seconds: true })

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
          <Tooltip title="Previous event">
            <IconButton size="small" onClick={handlePreviousEvent}>
              <SkipPreviousIcon />
            </IconButton>
          </Tooltip>
          <Tooltip title={isPlaying ? 'Pause' : 'Play'}>
            <IconButton size="small" onClick={handlePlayPause} color="primary">
              {isPlaying ? <PauseIcon /> : <PlayIcon />}
            </IconButton>
          </Tooltip>
          <Tooltip title="Next event">
            <IconButton size="small" onClick={handleNextEvent}>
              <SkipNextIcon />
            </IconButton>
          </Tooltip>
        </Box>

        {/* Timeline slider */}
        <Box sx={{ flexGrow: 1, px: 2, position: 'relative' }}>
          {/* Event markers */}
          {markers.map((marker, idx) => {
            const markerTime = new Date(marker.time).getTime()
            const pct = ((markerTime - startDate.getTime()) / totalDuration) * 100
            if (pct < 0 || pct > 100) return null
            return (
              <Tooltip key={idx} title={`${marker.label}`} placement="top" arrow>
                <Box
                  onMouseDown={(e: React.MouseEvent) => {
                    e.stopPropagation()
                    e.preventDefault()
                    setIsPlaying(false)
                    onTimeChange(new Date(marker.time))
                  }}
                  onClick={(e: React.MouseEvent) => {
                    e.stopPropagation()
                    e.preventDefault()
                  }}
                  sx={{
                    position: 'absolute',
                    left: `${pct}%`,
                    top: 2,
                    transform: 'translateX(-50%)',
                    width: 10,
                    height: 10,
                    borderRadius: '50%',
                    bgcolor: marker.color,
                    border: '1.5px solid rgba(0,0,0,0.6)',
                    cursor: 'pointer',
                    zIndex: 10,
                    transition: 'transform 0.15s',
                    '&:hover': {
                      transform: 'translateX(-50%) scale(1.6)',
                      boxShadow: `0 0 8px ${marker.color}`,
                    },
                  }}
                />
              </Tooltip>
            )
          })}
          {/* "Now" marker line */}
          {(() => {
            const nowPct = ((nowMs - startDate.getTime()) / totalDuration) * 100
            if (nowPct < 0 || nowPct > 100) return null
            return (
              <Tooltip title="Now" placement="top">
                <Box
                  sx={{
                    position: 'absolute',
                    left: `${nowPct}%`,
                    top: 0,
                    bottom: 0,
                    width: 2,
                    bgcolor: 'rgba(255,255,255,0.4)',
                    zIndex: 5,
                    pointerEvents: 'none',
                    '&::after': {
                      content: '"NOW"',
                      position: 'absolute',
                      top: -14,
                      left: '50%',
                      transform: 'translateX(-50%)',
                      fontSize: '0.5rem',
                      fontWeight: 700,
                      color: 'rgba(255,255,255,0.5)',
                      letterSpacing: 1,
                    },
                  }}
                />
              </Tooltip>
            )
          })()}
          <Slider
            value={sliderValue}
            onChange={handleSliderChange}
            sx={{
              '& .MuiSlider-markLabel': {
                fontSize: '0.7rem',
              },
              // Color the track: past portion is dimmer, future is brighter
              '& .MuiSlider-track': {
                background: (() => {
                  const nowPct = ((nowMs - startDate.getTime()) / totalDuration) * 100
                  const clampedNow = Math.max(0, Math.min(100, nowPct))
                  // track goes from 0 to sliderValue
                  if (sliderValue <= 0) return '#1976d2'
                  const nowRatio = (clampedNow / sliderValue) * 100
                  if (nowRatio >= 100) return '#1976d2' // all past
                  if (nowRatio <= 0) return '#ff9800' // all future
                  return `linear-gradient(90deg, #1976d2 ${nowRatio}%, #ff9800 ${nowRatio}%)`
                })(),
              },
              '& .MuiSlider-rail': {
                background: (() => {
                  const nowPct = ((nowMs - startDate.getTime()) / totalDuration) * 100
                  const clampedNow = Math.max(0, Math.min(100, nowPct))
                  return `linear-gradient(90deg, rgba(255,255,255,0.15) ${clampedNow}%, rgba(255,152,0,0.15) ${clampedNow}%)`
                })(),
                opacity: 1,
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
              onChange={e => setSpeed(Number(e.target.value))}
              sx={{ fontSize: '0.875rem' }}
              inputProps={{ 'aria-label': 'Playback speed' }}
            >
              {SPEEDS.map(o => (
                <MenuItem key={o.value} value={o.value}>
                  {o.label}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </Box>
      </Box>
    </Paper>
  )
}

export default TimelineControl

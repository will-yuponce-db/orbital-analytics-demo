import React, { useState, useEffect, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Fab,
  Badge,
  Drawer,
  Box,
  Typography,
  Stack,
  Chip,
  IconButton,
  Divider,
  TextField,
  Paper,
  CircularProgress,
  Tabs,
  Tab,
  Tooltip,
} from '@mui/material'
import { alpha } from '@mui/material/styles'
import {
  SmartToy as AIIcon,
  Close as CloseIcon,
  AccessTime as TimeIcon,
  Send as SendIcon,
  NotificationsActive as AlertIcon,
} from '@mui/icons-material'
import useNow from '../hooks/useNow'
import useConjunctionEvents from '../hooks/useConjunctionEvents'
import useOverview from '../hooks/useOverview'
import { isUpcoming, type ConjunctionView } from '../utils/conjunctions'
import { formatMissDistance, formatTcaCountdown, formatUtc, prettyModelName } from '../utils/format'
import { TIER_COLOR } from '../utils/riskStyle'
import { ASSISTANT_EVENT, type AssistantRequest } from '../utils/assistant'
import PcValue from './PcValue'
import RiskTierChip from './RiskTierChip'

interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
  error?: boolean
}

function formatMarkdown(text: string): React.ReactNode {
  const lines = text.split('\n')
  return lines.map((line, i) => {
    if (line.match(/^[-*]\s/)) line = line.replace(/^[-*]\s/, '  • ')
    const parts = line.split(/(\*\*[^*]+\*\*|`[^`]+`)/)
    const rendered = parts.map((part, j) => {
      if (part.startsWith('**') && part.endsWith('**'))
        return <strong key={j}>{part.slice(2, -2)}</strong>
      if (part.startsWith('`') && part.endsWith('`')) {
        return (
          <Box
            key={j}
            component="span"
            sx={{
              fontFamily: 'monospace',
              bgcolor: 'rgba(255,255,255,0.08)',
              px: 0.5,
              borderRadius: 0.5,
              fontSize: '0.75rem',
            }}
          >
            {part.slice(1, -1)}
          </Box>
        )
      }
      return part
    })
    return (
      <React.Fragment key={i}>
        {rendered}
        {i < lines.length - 1 && <br />}
      </React.Fragment>
    )
  })
}

const SUGGESTED = [
  'What needs attention in the next 24 hours?',
  'Which conjunctions are red tier right now?',
  'Where does the ML model disagree with the 18 SDS Pc?',
  'Plan a maneuver for the highest-risk upcoming event',
]

const AlertCard: React.FC<{ event: ConjunctionView; now: number; onOpen: () => void }> = ({
  event,
  now,
  onOpen,
}) => {
  const color = TIER_COLOR[event.riskTier]
  return (
    <Box
      role="button"
      tabIndex={0}
      onClick={onOpen}
      onKeyDown={(e: React.KeyboardEvent) => {
        if (e.key === 'Enter') onOpen()
      }}
      sx={{
        p: 1.5,
        borderRadius: 1,
        border: '1px solid',
        borderColor: alpha(color, 0.6),
        borderLeftWidth: 4,
        bgcolor: alpha(color, 0.06),
        cursor: 'pointer',
        '&:hover': { bgcolor: alpha(color, 0.12) },
      }}
    >
      <Stack direction="row" justifyContent="space-between" alignItems="flex-start" spacing={1}>
        <Box sx={{ minWidth: 0 }}>
          <Typography variant="body2" fontWeight={600} sx={{ fontSize: '0.85rem' }} noWrap>
            {event.satelliteA.name}
          </Typography>
          <Typography variant="caption" color="text.secondary" noWrap display="block">
            {'×'} {event.satelliteB.name}
          </Typography>
        </Box>
        <RiskTierChip tier={event.riskTier} />
      </Stack>
      <Stack direction="row" spacing={2} mt={1}>
        <Box>
          <Typography variant="caption" color="text.secondary" display="block">
            Pc (18 SDS)
          </Typography>
          <PcValue pc={event.rawPc} variant="body2" fontWeight={700} sx={{ fontSize: '0.8rem' }} />
        </Box>
        <Box>
          <Typography variant="caption" color="text.secondary" display="block">
            Pc (ML)
          </Typography>
          <PcValue pc={event.mlPc} variant="body2" fontWeight={600} sx={{ fontSize: '0.8rem' }} />
        </Box>
        <Box>
          <Typography variant="caption" color="text.secondary" display="block">
            Miss
          </Typography>
          <Typography variant="body2" fontWeight={600} sx={{ fontSize: '0.8rem' }}>
            {formatMissDistance(event.missDistanceM)}
          </Typography>
        </Box>
      </Stack>
      <Stack direction="row" spacing={0.5} alignItems="center" mt={0.75}>
        <TimeIcon sx={{ fontSize: 12, color: 'text.secondary' }} />
        <Typography variant="caption" fontWeight={600} sx={{ fontVariantNumeric: 'tabular-nums' }}>
          {formatTcaCountdown(event.tcaMs, now)}
        </Typography>
        <Typography variant="caption" color="text.disabled">
          {'·'} {formatUtc(event.tca)}
        </Typography>
      </Stack>
    </Box>
  )
}

const AlertFAB: React.FC = () => {
  const navigate = useNavigate()
  const now = useNow(1000)
  const { events } = useConjunctionEvents()
  const { data: overview } = useOverview()
  const [open, setOpen] = useState(false)
  const [tab, setTab] = useState(0)

  // Chat state
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  // Draggable state
  const [position, setPosition] = useState({ x: 24, y: 24 })
  const [dragging, setDragging] = useState(false)
  const dragStart = useRef({ x: 0, y: 0, posX: 0, posY: 0 })
  const didDrag = useRef(false)

  // Alerts: upcoming red and amber events, red first, then soonest TCA.
  const alerts = (events ?? [])
    .filter(e => isUpcoming(e, now) && (e.riskTier === 'red' || e.riskTier === 'amber'))
    .sort((a, b) => (a.riskTier === b.riskTier ? a.tcaMs - b.tcaMs : a.riskTier === 'red' ? -1 : 1))
  const redCount = alerts.filter(a => a.riskTier === 'red').length
  const totalCount = alerts.length
  const chatModel = prettyModelName(overview?.chatModel)

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight
  }, [messages, loading])

  const sendMessage = async (text: string) => {
    if (!text.trim()) return
    if (loading) {
      setInput(text)
      return
    }
    const userMsg: ChatMessage = { role: 'user', content: text.trim() }
    const newMessages = [...messages, userMsg]
    setMessages(newMessages)
    setInput('')
    setLoading(true)
    setTab(0)

    try {
      const resp = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: newMessages
            .filter(m => !m.error)
            .map(m => ({ role: m.role, content: m.content })),
        }),
      })
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`)
      const data = await resp.json()
      setMessages(prev => [...prev, { role: 'assistant', content: data.content || 'No response.' }])
    } catch (err) {
      const reason = err instanceof Error ? err.message : String(err)
      setMessages(prev => [
        ...prev,
        {
          role: 'assistant',
          error: true,
          content: `The assistant could not be reached (${reason}). Try again in a moment.`,
        },
      ])
    } finally {
      setLoading(false)
      window.setTimeout(() => inputRef.current?.focus(), 100)
    }
  }

  // Other views open the drawer, optionally with a prompt, through ASSISTANT_EVENT.
  const sendRef = useRef(sendMessage)
  useEffect(() => {
    sendRef.current = sendMessage
  })
  useEffect(() => {
    const onRequest = (e: Event) => {
      const detail = (e as CustomEvent<AssistantRequest>).detail ?? {}
      setOpen(true)
      setTab(detail.tab === 'alerts' ? 1 : 0)
      if (detail.prompt) void sendRef.current(detail.prompt)
    }
    window.addEventListener(ASSISTANT_EVENT, onRequest)
    return () => window.removeEventListener(ASSISTANT_EVENT, onRequest)
  }, [])

  // Drag handlers
  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      setDragging(true)
      didDrag.current = false
      dragStart.current = { x: e.clientX, y: e.clientY, posX: position.x, posY: position.y }
      e.preventDefault()
    },
    [position]
  )

  useEffect(() => {
    if (!dragging) return
    const handleMouseMove = (e: MouseEvent) => {
      const dx = e.clientX - dragStart.current.x
      const dy = e.clientY - dragStart.current.y
      if (Math.abs(dx) > 3 || Math.abs(dy) > 3) didDrag.current = true
      setPosition({
        x: Math.max(8, Math.min(window.innerWidth - 64, dragStart.current.posX - dx)),
        y: Math.max(8, Math.min(window.innerHeight - 64, dragStart.current.posY - dy)),
      })
    }
    const handleMouseUp = () => setDragging(false)
    window.addEventListener('mousemove', handleMouseMove)
    window.addEventListener('mouseup', handleMouseUp)
    return () => {
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mouseup', handleMouseUp)
    }
  }, [dragging])

  const handleClick = () => {
    if (!didDrag.current) setOpen(true)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      void sendMessage(input)
    }
  }

  const fabLabel = totalCount
    ? `Open assistant and alerts: ${redCount} red and ${totalCount - redCount} amber upcoming events`
    : 'Open assistant and alerts'

  return (
    <>
      <Tooltip title={fabLabel} placement="left">
        <Fab
          color={redCount > 0 ? 'error' : 'primary'}
          onMouseDown={handleMouseDown}
          onClick={handleClick}
          aria-label={fabLabel}
          sx={{
            position: 'fixed',
            bottom: position.y,
            right: position.x,
            zIndex: 1300,
            cursor: dragging ? 'grabbing' : 'grab',
            animation: redCount > 0 ? 'fabPulse 2s infinite' : 'none',
            '@keyframes fabPulse': {
              '0%': { boxShadow: '0 0 0 0 rgba(244,67,54,0.5)' },
              '70%': { boxShadow: '0 0 0 14px rgba(244,67,54,0)' },
              '100%': { boxShadow: '0 0 0 0 rgba(244,67,54,0)' },
            },
            '@media (prefers-reduced-motion: reduce)': { animation: 'none' },
          }}
        >
          <Badge
            badgeContent={totalCount || undefined}
            color="warning"
            sx={{ '& .MuiBadge-badge': { fontWeight: 700 } }}
          >
            <AIIcon />
          </Badge>
        </Fab>
      </Tooltip>

      <Drawer
        anchor="right"
        open={open}
        onClose={() => setOpen(false)}
        PaperProps={{
          sx: {
            width: 400,
            maxWidth: '100vw',
            bgcolor: 'background.paper',
            display: 'flex',
            flexDirection: 'column',
          },
        }}
      >
        <Box sx={{ p: 1.5, borderBottom: 1, borderColor: 'divider' }}>
          <Stack direction="row" justifyContent="space-between" alignItems="center">
            <Stack direction="row" spacing={1} alignItems="center" sx={{ minWidth: 0 }}>
              <AIIcon color="primary" />
              <Typography variant="subtitle1" fontWeight={700} noWrap>
                OrbitWatch Assistant
              </Typography>
              {chatModel && (
                <Chip
                  label={chatModel}
                  size="small"
                  sx={{
                    height: 18,
                    fontSize: '0.6rem',
                    fontWeight: 700,
                    bgcolor: 'rgba(179,157,219,0.15)',
                    color: '#b39ddb',
                  }}
                />
              )}
            </Stack>
            <IconButton onClick={() => setOpen(false)} size="small" aria-label="Close assistant">
              <CloseIcon />
            </IconButton>
          </Stack>
        </Box>

        <Tabs
          value={tab}
          onChange={(_e: React.SyntheticEvent, v: number) => setTab(v)}
          sx={{
            borderBottom: 1,
            borderColor: 'divider',
            minHeight: 36,
            '& .MuiTab-root': { minHeight: 36, textTransform: 'none', fontSize: '0.8rem' },
          }}
        >
          <Tab label="Chat" icon={<AIIcon sx={{ fontSize: 16 }} />} iconPosition="start" />
          <Tab
            label={`Alerts${totalCount ? ` (${totalCount})` : ''}`}
            icon={<AlertIcon sx={{ fontSize: 16, color: redCount > 0 ? '#f44336' : undefined }} />}
            iconPosition="start"
          />
        </Tabs>

        {tab === 0 && (
          <Box sx={{ flexGrow: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            <Box ref={scrollRef} sx={{ flexGrow: 1, overflow: 'auto', p: 1.5 }}>
              {messages.length === 0 && !loading && (
                <Box sx={{ mt: 2 }}>
                  <Typography
                    variant="body2"
                    color="text.secondary"
                    sx={{ mb: 0.75, textAlign: 'center', fontSize: '0.8rem' }}
                  >
                    Ask about conjunctions, risk, ML predictions or maneuver options.
                  </Typography>
                  <Typography
                    variant="caption"
                    color="text.disabled"
                    display="block"
                    sx={{ mb: 2, textAlign: 'center' }}
                  >
                    Answers come from tool calls against the live Lakebase data. Review them before
                    acting.
                  </Typography>
                  <Stack spacing={1}>
                    {SUGGESTED.map(q => (
                      <Paper
                        key={q}
                        variant="outlined"
                        onClick={() => void sendMessage(q)}
                        sx={{
                          p: 1,
                          cursor: 'pointer',
                          transition: 'all 0.15s',
                          '&:hover': {
                            borderColor: 'primary.main',
                            bgcolor: 'rgba(33,150,243,0.04)',
                          },
                        }}
                      >
                        <Typography variant="caption">{q}</Typography>
                      </Paper>
                    ))}
                  </Stack>
                </Box>
              )}

              {messages.map((msg, i) => (
                <Box
                  key={i}
                  sx={{
                    mb: 1.5,
                    display: 'flex',
                    justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start',
                  }}
                >
                  <Paper
                    sx={{
                      p: 1.5,
                      maxWidth: '90%',
                      bgcolor:
                        msg.role === 'user'
                          ? 'primary.dark'
                          : msg.error
                            ? 'rgba(244,67,54,0.08)'
                            : 'rgba(255,255,255,0.04)',
                      border: msg.role === 'assistant' ? '1px solid' : 'none',
                      borderColor: msg.error ? 'error.dark' : 'divider',
                    }}
                  >
                    <Typography
                      variant="body2"
                      sx={{ fontSize: '0.78rem', lineHeight: 1.5, whiteSpace: 'pre-wrap' }}
                    >
                      {msg.role === 'assistant' ? formatMarkdown(msg.content) : msg.content}
                    </Typography>
                  </Paper>
                </Box>
              ))}

              {loading && (
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5 }}>
                  <CircularProgress size={14} />
                  <Typography variant="caption" color="text.secondary">
                    Working: querying live data
                  </Typography>
                </Box>
              )}
            </Box>

            <Box sx={{ p: 1.5, borderTop: 1, borderColor: 'divider' }}>
              <Stack direction="row" spacing={1} alignItems="flex-end">
                <TextField
                  inputRef={inputRef}
                  fullWidth
                  size="small"
                  multiline
                  maxRows={4}
                  placeholder="Ask about what is happening"
                  value={input}
                  onChange={e => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  disabled={loading}
                  sx={{ '& .MuiOutlinedInput-root': { fontSize: '0.82rem' } }}
                />
                <IconButton
                  color="primary"
                  onClick={() => void sendMessage(input)}
                  disabled={!input.trim() || loading}
                  size="small"
                  aria-label="Send"
                >
                  <SendIcon fontSize="small" />
                </IconButton>
              </Stack>
            </Box>
          </Box>
        )}

        {tab === 1 && (
          <Box sx={{ flexGrow: 1, overflow: 'auto', p: 1.5 }}>
            {totalCount === 0 ? (
              <Box sx={{ textAlign: 'center', mt: 4 }}>
                <Typography variant="body2" color="text.secondary">
                  {events ? 'No upcoming red or amber events.' : 'Loading events'}
                </Typography>
              </Box>
            ) : (
              <>
                <Stack direction="row" spacing={1} mb={1.5} alignItems="center">
                  {redCount > 0 && (
                    <Chip
                      label={`${redCount} RED`}
                      size="small"
                      color="error"
                      sx={{ fontWeight: 700 }}
                    />
                  )}
                  {totalCount - redCount > 0 && (
                    <Chip
                      label={`${totalCount - redCount} AMBER`}
                      size="small"
                      color="warning"
                      sx={{ fontWeight: 700 }}
                    />
                  )}
                  <Typography variant="caption" color="text.secondary">
                    Upcoming events only
                  </Typography>
                </Stack>
                <Divider sx={{ mb: 1.5 }} />
                <Stack spacing={1.5}>
                  {alerts.map(a => (
                    <AlertCard
                      key={a.eventKey}
                      event={a}
                      now={now}
                      onOpen={() => {
                        setOpen(false)
                        navigate(`/scenario/${encodeURIComponent(a.cdmId)}`)
                      }}
                    />
                  ))}
                </Stack>
              </>
            )}
          </Box>
        )}
      </Drawer>
    </>
  )
}

export default AlertFAB

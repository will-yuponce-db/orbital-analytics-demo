import React, { useState } from 'react'
import {
  Box,
  Typography,
  Paper,
  Stack,
  Chip,
  Button,
  List,
  Divider,
  IconButton,
  Badge,
} from '@mui/material'
import {
  Campaign as AlertIcon,
  PriorityHigh as PriorityIcon,
  CheckCircle as AckIcon,
  Share as ShareIcon,
  ExpandMore as ExpandIcon,
  ExpandLess as CollapseIcon,
} from '@mui/icons-material'
import { C2Alert } from '../types'

interface C2AlertPanelProps {
  alerts: C2Alert[]
  currentUserId: string
  onAcknowledge?: (alertId: string) => void
  onDisseminate?: (alertId: string) => void
}

const C2AlertPanel: React.FC<C2AlertPanelProps> = ({
  alerts,
  currentUserId,
  onAcknowledge,
  onDisseminate,
}) => {
  const [expandedAlerts, setExpandedAlerts] = useState<Set<string>>(new Set())

  const getPriorityColor = (priority: string): 'default' | 'info' | 'warning' | 'error' => {
    switch (priority) {
      case 'flash':
        return 'error'
      case 'immediate':
        return 'error'
      case 'priority':
        return 'warning'
      default:
        return 'info'
    }
  }

  const getAlertTypeIcon = (type: string) => {
    switch (type) {
      case 'threat-detection':
      case 'ew-attack':
        return '⚠️'
      case 'conjunction':
        return '💥'
      case 'maneuver-required':
        return '🛰️'
      case 'anomaly':
        return '🔍'
      default:
        return '📡'
    }
  }

  const toggleExpanded = (alertId: string) => {
    const newExpanded = new Set(expandedAlerts)
    if (newExpanded.has(alertId)) {
      newExpanded.delete(alertId)
    } else {
      newExpanded.add(alertId)
    }
    setExpandedAlerts(newExpanded)
  }

  const isAcknowledged = (alert: C2Alert): boolean => {
    return alert.acknowledgedBy?.includes(currentUserId) || false
  }

  const unresolvedAlerts = alerts.filter(a => !a.resolvedAt)
  const flashAlerts = unresolvedAlerts.filter(
    a => a.priority === 'flash' || a.priority === 'immediate'
  )

  return (
    <Box sx={{ height: '100%', overflow: 'auto', p: 2 }}>
      <Stack spacing={3}>
        {/* Header */}
        <Box>
          <Stack direction="row" spacing={1} alignItems="center" justifyContent="space-between">
            <Stack direction="row" spacing={1} alignItems="center">
              <Badge badgeContent={flashAlerts.length} color="error">
                <AlertIcon color="primary" />
              </Badge>
              <Typography variant="h6">Command & Control Alerts</Typography>
            </Stack>
            <Chip
              label={`${unresolvedAlerts.length} ACTIVE`}
              color="error"
              size="small"
              sx={{ fontWeight: 'bold' }}
            />
          </Stack>
          <Typography variant="caption" color="text.secondary">
            Real-time operational alerts and notifications
          </Typography>
        </Box>

        {/* Flash Priority Alerts */}
        {flashAlerts.length > 0 && (
          <Paper
            sx={{
              p: 2,
              bgcolor: 'error.main',
              color: 'white',
              animation: 'pulse 2s infinite',
              '@keyframes pulse': {
                '0%, 100%': { opacity: 1 },
                '50%': { opacity: 0.8 },
              },
            }}
          >
            <Stack direction="row" spacing={1} alignItems="center">
              <PriorityIcon />
              <Typography variant="body2" fontWeight="bold">
                {flashAlerts.length} FLASH/IMMEDIATE PRIORITY ALERT
                {flashAlerts.length > 1 ? 'S' : ''}
              </Typography>
            </Stack>
            <Typography variant="caption">
              Requires immediate attention and acknowledgment
            </Typography>
          </Paper>
        )}

        <Divider />

        {/* Alerts List */}
        <List sx={{ p: 0 }}>
          {alerts
            .sort((a, b) => {
              const priorityOrder = { flash: 0, immediate: 1, priority: 2, routine: 3 }
              return (
                (priorityOrder[a.priority as keyof typeof priorityOrder] || 4) -
                (priorityOrder[b.priority as keyof typeof priorityOrder] || 4)
              )
            })
            .map(alert => {
              const isExpanded = expandedAlerts.has(alert.id)
              const acknowledged = isAcknowledged(alert)
              const resolved = !!alert.resolvedAt

              return (
                <Paper
                  key={alert.id}
                  elevation={resolved ? 0 : 3}
                  sx={{
                    mb: 2,
                    border: '2px solid',
                    borderColor: resolved
                      ? 'divider'
                      : alert.priority === 'flash' || alert.priority === 'immediate'
                        ? 'error.main'
                        : alert.priority === 'priority'
                          ? 'warning.main'
                          : 'info.main',
                    opacity: resolved ? 0.6 : 1,
                  }}
                >
                  {/* Alert Header */}
                  <Box
                    sx={{
                      p: 2,
                      cursor: 'pointer',
                      bgcolor: resolved ? 'background.paper' : 'background.default',
                    }}
                    onClick={() => toggleExpanded(alert.id)}
                  >
                    <Stack spacing={1}>
                      <Box display="flex" justifyContent="space-between" alignItems="flex-start">
                        <Stack direction="row" spacing={1} alignItems="center" flex={1}>
                          <Typography fontSize="1.5rem">
                            {getAlertTypeIcon(alert.alertType)}
                          </Typography>
                          <Box flex={1}>
                            <Typography variant="body1" fontWeight="bold">
                              {alert.title}
                            </Typography>
                            <Typography variant="caption" color="text.secondary">
                              {new Date(alert.timestamp).toLocaleString()} |{' '}
                              {alert.alertType.toUpperCase()}
                            </Typography>
                          </Box>
                        </Stack>
                        <Stack direction="row" spacing={1} alignItems="center">
                          <Chip
                            label={alert.priority.toUpperCase()}
                            color={getPriorityColor(alert.priority)}
                            size="small"
                            sx={{ fontWeight: 'bold' }}
                          />
                          {acknowledged && (
                            <Chip label="ACK" color="success" size="small" icon={<AckIcon />} />
                          )}
                          {resolved && <Chip label="RESOLVED" color="default" size="small" />}
                          <IconButton size="small" onClick={() => toggleExpanded(alert.id)}>
                            {isExpanded ? <CollapseIcon /> : <ExpandIcon />}
                          </IconButton>
                        </Stack>
                      </Box>

                      {/* Classification */}
                      <Chip
                        label={alert.classification.level}
                        size="small"
                        sx={{
                          bgcolor:
                            alert.classification.level === 'SECRET'
                              ? 'error.dark'
                              : alert.classification.level === 'CONFIDENTIAL'
                                ? 'info.dark'
                                : 'success.dark',
                          color: 'white',
                          fontWeight: 'bold',
                          width: 'fit-content',
                        }}
                      />

                      {/* Brief Description */}
                      {!isExpanded && (
                        <Typography variant="body2" color="text.secondary" noWrap>
                          {alert.description}
                        </Typography>
                      )}
                    </Stack>
                  </Box>

                  {/* Expanded Details */}
                  {isExpanded && (
                    <Box sx={{ p: 2, pt: 0 }}>
                      <Divider sx={{ mb: 2 }} />

                      <Stack spacing={2}>
                        {/* Description */}
                        <Box>
                          <Typography variant="caption" color="text.secondary" fontWeight="bold">
                            DESCRIPTION
                          </Typography>
                          <Typography variant="body2">{alert.description}</Typography>
                        </Box>

                        {/* Affected Assets */}
                        <Box>
                          <Typography variant="caption" color="text.secondary" fontWeight="bold">
                            AFFECTED ASSETS ({alert.affectedAssets.length})
                          </Typography>
                          <Stack
                            direction="row"
                            spacing={0.5}
                            flexWrap="wrap"
                            useFlexGap
                            sx={{ mt: 0.5 }}
                          >
                            {alert.affectedAssets.map((asset, idx) => (
                              <Chip key={idx} label={asset} size="small" variant="outlined" />
                            ))}
                          </Stack>
                        </Box>

                        {/* Recommended Actions */}
                        <Box>
                          <Typography variant="caption" color="text.secondary" fontWeight="bold">
                            RECOMMENDED ACTIONS
                          </Typography>
                          <List dense sx={{ pl: 2 }}>
                            {alert.recommendedActions.map((action, idx) => (
                              <li key={idx}>
                                <Typography variant="body2">{action}</Typography>
                              </li>
                            ))}
                          </List>
                        </Box>

                        {/* Dissemination */}
                        <Box>
                          <Typography variant="caption" color="text.secondary" fontWeight="bold">
                            DISSEMINATION
                          </Typography>
                          <Stack
                            direction="row"
                            spacing={0.5}
                            flexWrap="wrap"
                            useFlexGap
                            sx={{ mt: 0.5 }}
                          >
                            {alert.disseminationList.map((unit, idx) => (
                              <Chip key={idx} label={unit} size="small" color="primary" />
                            ))}
                          </Stack>
                        </Box>

                        {/* Acknowledgments */}
                        {alert.acknowledgedBy && alert.acknowledgedBy.length > 0 && (
                          <Box>
                            <Typography variant="caption" color="text.secondary" fontWeight="bold">
                              ACKNOWLEDGED BY ({alert.acknowledgedBy.length})
                            </Typography>
                            <Stack
                              direction="row"
                              spacing={0.5}
                              flexWrap="wrap"
                              useFlexGap
                              sx={{ mt: 0.5 }}
                            >
                              {alert.acknowledgedBy.map((user, idx) => (
                                <Chip
                                  key={idx}
                                  label={user}
                                  size="small"
                                  icon={<AckIcon />}
                                  color="success"
                                />
                              ))}
                            </Stack>
                          </Box>
                        )}

                        {/* Actions */}
                        <Stack direction="row" spacing={1}>
                          {!acknowledged && !resolved && (
                            <Button
                              variant="contained"
                              color="success"
                              size="small"
                              startIcon={<AckIcon />}
                              onClick={(e: React.MouseEvent) => {
                                e.stopPropagation()
                                onAcknowledge?.(alert.id)
                              }}
                            >
                              Acknowledge
                            </Button>
                          )}
                          <Button
                            variant="outlined"
                            size="small"
                            startIcon={<ShareIcon />}
                            onClick={(e: React.MouseEvent) => {
                              e.stopPropagation()
                              onDisseminate?.(alert.id)
                            }}
                          >
                            Disseminate
                          </Button>
                        </Stack>
                      </Stack>
                    </Box>
                  )}
                </Paper>
              )
            })}
        </List>

        {alerts.length === 0 && (
          <Box sx={{ textAlign: 'center', py: 4 }}>
            <AlertIcon sx={{ fontSize: 60, color: 'text.disabled', mb: 2 }} />
            <Typography variant="body2" color="text.secondary">
              No active alerts
            </Typography>
          </Box>
        )}
      </Stack>
    </Box>
  )
}

export default C2AlertPanel

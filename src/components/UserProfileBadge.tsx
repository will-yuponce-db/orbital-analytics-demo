import React, { useState } from 'react'
import {
  Box,
  Avatar,
  Typography,
  Popover,
  Paper,
  Stack,
  Chip,
  Divider,
  IconButton,
} from '@mui/material'
import {
  Person as PersonIcon,
  AdminPanelSettings as AdminIcon,
  Engineering as EngineerIcon,
  Assessment as AnalystIcon,
  ControlCamera as OperatorIcon,
  Public as CoalitionIcon,
} from '@mui/icons-material'
import { UserProfile } from '../types'

interface UserProfileBadgeProps {
  user: UserProfile
}

const UserProfileBadge: React.FC<UserProfileBadgeProps> = ({ user }) => {
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null)

  const handleClick = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget)
  }

  const handleClose = () => {
    setAnchorEl(null)
  }

  const getRoleIcon = (role: string) => {
    switch (role) {
      case 'admin':
        return <AdminIcon />
      case 'engineer':
        return <EngineerIcon />
      case 'analyst':
        return <AnalystIcon />
      case 'operator':
        return <OperatorIcon />
      case 'coalition-partner':
        return <CoalitionIcon />
      default:
        return <PersonIcon />
    }
  }

  const getRoleColor = (role: string): string => {
    switch (role) {
      case 'admin':
        return '#FF6B6B'
      case 'commander':
        return '#9B59B6'
      case 'engineer':
        return '#3498DB'
      case 'analyst':
        return '#2ECC71'
      case 'operator':
        return '#F39C12'
      case 'coalition-partner':
        return '#95A5A6'
      default:
        return '#7F8C8D'
    }
  }

  const getInitials = (username: string): string => {
    const parts = username.split('.')
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase()
    }
    return username.substring(0, 2).toUpperCase()
  }

  const open = Boolean(anchorEl)

  return (
    <>
      <IconButton
        onClick={handleClick}
        sx={{
          p: 0.5,
          '&:hover': {
            bgcolor: 'action.hover',
          },
        }}
      >
        <Avatar
          sx={{
            width: 36,
            height: 36,
            bgcolor: getRoleColor(user.role),
            fontSize: '0.9rem',
            fontWeight: 'bold',
            border: '2px solid',
            borderColor: 'primary.main',
          }}
        >
          {getInitials(user.username)}
        </Avatar>
      </IconButton>

      <Popover
        open={open}
        anchorEl={anchorEl}
        onClose={handleClose}
        anchorOrigin={{
          vertical: 'bottom',
          horizontal: 'right',
        }}
        transformOrigin={{
          vertical: 'top',
          horizontal: 'right',
        }}
      >
        <Paper sx={{ width: 280, p: 2 }}>
          <Stack spacing={2}>
            {/* Header */}
            <Box display="flex" alignItems="center" gap={2}>
              <Avatar
                sx={{
                  width: 56,
                  height: 56,
                  bgcolor: getRoleColor(user.role),
                  fontSize: '1.2rem',
                  fontWeight: 'bold',
                  border: '3px solid',
                  borderColor: 'primary.main',
                }}
              >
                {getInitials(user.username)}
              </Avatar>
              <Box flex={1}>
                <Typography variant="body1" fontWeight="bold">
                  {user.username.replace('.', ' ').toUpperCase()}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {user.organization}
                </Typography>
              </Box>
            </Box>

            <Divider />

            {/* Role */}
            <Box>
              <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1 }}>
                {getRoleIcon(user.role)}
                <Typography variant="body2" fontWeight="bold">
                  Role
                </Typography>
              </Stack>
              <Chip
                label={user.role.toUpperCase().replace(/-/g, ' ')}
                size="small"
                sx={{
                  bgcolor: getRoleColor(user.role),
                  color: 'white',
                  fontWeight: 'bold',
                }}
              />
            </Box>

            <Divider />

            {/* Session Info */}
            <Box>
              <Typography variant="caption" color="text.secondary">
                Last Login: {new Date(user.lastLogin).toLocaleString()}
              </Typography>
              <Typography variant="caption" color="text.secondary" display="block">
                User ID: {user.id}
              </Typography>
            </Box>
          </Stack>
        </Paper>
      </Popover>
    </>
  )
}

export default UserProfileBadge

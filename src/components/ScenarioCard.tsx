import React from 'react'
import { useNavigate } from 'react-router-dom'
import { Card, CardContent, CardActionArea, Typography, Box, Chip, Stack } from '@mui/material'
import {
  Satellite as SatelliteIcon,
  Schedule as ScheduleIcon,
  SmartToy as AIIcon,
  Movie as CampaignIcon,
} from '@mui/icons-material'
import { Scenario, CampaignScenario } from '../types'
import DataQualityBadge from './DataQualityBadge'
import { useTheme } from '@mui/material/styles'

interface ScenarioCardProps {
  scenario: Scenario
}

const ScenarioCard: React.FC<ScenarioCardProps> = ({ scenario }) => {
  const navigate = useNavigate()
  const theme = useTheme()

  const campaignScenario = (scenario as CampaignScenario).isPartOfCampaign
    ? (scenario as CampaignScenario)
    : null

  const getStatusColor = () => {
    return theme.palette.status[scenario.aiDecisionStatus]
  }

  const handleClick = () => {
    navigate(`/scenario/${scenario.id}`)
  }

  return (
    <Card
      sx={{
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        border: campaignScenario ? '2px solid' : 'none',
        borderColor: campaignScenario ? 'warning.main' : 'transparent',
      }}
    >
      <CardActionArea onClick={handleClick} sx={{ flexGrow: 1 }}>
        <Box
          sx={{
            height: 120,
            background: campaignScenario
              ? `linear-gradient(135deg, #1e3a5f 0%, #8b4513 100%)`
              : `linear-gradient(135deg, ${theme.palette.background.paper} 0%, ${theme.palette.primary.dark} 100%)`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            position: 'relative',
            overflow: 'hidden',
          }}
        >
          {campaignScenario ? (
            <CampaignIcon sx={{ fontSize: 60, opacity: 0.3 }} />
          ) : (
            <SatelliteIcon sx={{ fontSize: 60, opacity: 0.3 }} />
          )}
          <Box sx={{ position: 'absolute', top: 8, right: 8 }}>
            <DataQualityBadge quality={scenario.dataQuality} />
          </Box>
          {campaignScenario && (
            <Box sx={{ position: 'absolute', top: 8, left: 8 }}>
              <Chip
                icon={<CampaignIcon />}
                label={`Day ${campaignScenario.storyContext?.dayNumber}`}
                size="small"
                color="warning"
                sx={{ fontWeight: 'bold' }}
              />
            </Box>
          )}
        </Box>
        <CardContent>
          <Typography variant="h6" component="div" gutterBottom noWrap>
            {scenario.name}
          </Typography>
          <Typography
            variant="body2"
            color="text.secondary"
            sx={{
              mb: 2,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              display: '-webkit-box',
              WebkitLineClamp: 2,
              WebkitBoxOrient: 'vertical',
              minHeight: '2.5em',
            }}
          >
            {scenario.description}
          </Typography>

          <Stack spacing={1}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <SatelliteIcon sx={{ fontSize: 16, color: 'text.secondary' }} />
              <Typography variant="body2" color="text.secondary">
                {scenario.satelliteCount} satellite{scenario.satelliteCount !== 1 ? 's' : ''}
              </Typography>
            </Box>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <ScheduleIcon sx={{ fontSize: 16, color: 'text.secondary' }} />
              <Typography variant="body2" color="text.secondary">
                {scenario.duration} minutes
              </Typography>
            </Box>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <AIIcon sx={{ fontSize: 16, color: getStatusColor() }} />
              <Typography
                variant="body2"
                sx={{
                  color: getStatusColor(),
                  textTransform: 'capitalize',
                  fontWeight: 600,
                }}
              >
                {scenario.aiDecisionStatus}
              </Typography>
            </Box>
          </Stack>

          <Box sx={{ mt: 2, display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
            {scenario.tags.slice(0, 3).map(tag => (
              <Chip key={tag} label={tag} size="small" variant="outlined" />
            ))}
          </Box>
        </CardContent>
      </CardActionArea>
    </Card>
  )
}

export default ScenarioCard

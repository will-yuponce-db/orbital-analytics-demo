import React from 'react'
import { Box, Paper, Stack, Typography } from '@mui/material'
import { alpha } from '@mui/material/styles'
import {
  SatelliteAlt as SourceIcon,
  AccountTree as PipelineIcon,
  Shield as CatalogIcon,
  Psychology as ModelIcon,
  Storage as LakebaseIcon,
  SmartToy as AppIcon,
  ChevronRight as ArrowIcon,
} from '@mui/icons-material'
import type { Overview } from '../services/api'
import { formatUtc, prettyModelName } from '../utils/format'

interface Step {
  title: string
  detail: string
  icon: React.ReactNode
  color: string
  live?: string | null
}

function steps(overview: Overview | null): Step[] {
  const model = overview?.model
  const version = model?.version ? ` v${model.version.replace(/^v/i, '')}` : ''
  return [
    {
      title: 'Space-Track CDM + GP',
      detail: 'Public conjunction data messages and GP element sets from the Space-Track API.',
      icon: <SourceIcon />,
      color: '#90caf9',
      live: overview?.dataAsOf ? `Newest CDM ${formatUtc(overview.dataAsOf)}` : null,
    },
    {
      title: 'Lakeflow Declarative Pipelines',
      detail:
        'Bronze to gold: parse CDMs, group updates per event, join orbital elements, assign risk tiers.',
      icon: <PipelineIcon />,
      color: '#80cbc4',
    },
    {
      title: 'Unity Catalog',
      detail: 'Governed Delta tables and the registered model, with lineage and access control.',
      icon: <CatalogIcon />,
      color: '#a5d6a7',
    },
    {
      title: 'MLflow / XGBoost Pc model',
      detail:
        'Trained on CDM history and logged with MLflow. Scores each CDM next to the 18 SDS Pc.',
      icon: <ModelIcon />,
      color: '#4fc3f7',
      live: model ? `Model${version}, trained ${formatUtc(model.trainedAt)}` : null,
    },
    {
      title: 'Lakebase (Postgres)',
      detail: 'Serving copy of events, scores and CDM history for low-latency reads by the app.',
      icon: <LakebaseIcon />,
      color: '#ffcc80',
      live: overview?.lastLoadedAt ? `Loaded ${formatUtc(overview.lastLoadedAt)}` : null,
    },
    {
      title: 'Databricks App + Claude assistant',
      detail:
        'This interface, plus an assistant that answers with tool calls against the live data.',
      icon: <AppIcon />,
      color: '#b39ddb',
      live: prettyModelName(overview?.chatModel),
    },
  ]
}

/** Data lineage from source to app, annotated with live timestamps when available. */
const PipelineLineage: React.FC<{ overview: Overview | null }> = ({ overview }) => (
  <Paper elevation={1} sx={{ p: { xs: 2.5, md: 3 }, border: '1px solid rgba(255,255,255,0.08)' }}>
    <Stack direction="row" alignItems="baseline" spacing={1.5} mb={2.5} flexWrap="wrap" useFlexGap>
      <Typography variant="h6" fontWeight={700}>
        How it works
      </Typography>
      <Typography variant="body2" color="text.secondary">
        From the Space-Track feed to this screen, on one platform.
      </Typography>
    </Stack>
    <Box
      component="ol"
      sx={{
        listStyle: 'none',
        m: 0,
        p: 0,
        display: 'grid',
        gridTemplateColumns: {
          xs: '1fr',
          sm: 'repeat(2, 1fr)',
          md: 'repeat(3, 1fr)',
          lg: 'repeat(6, 1fr)',
        },
        gap: { xs: 1.5, lg: 0 },
      }}
    >
      {steps(overview).map((s, i, all) => (
        <Box
          component="li"
          key={s.title}
          sx={{ display: 'flex', alignItems: 'stretch', minWidth: 0 }}
        >
          <Box sx={{ flexGrow: 1, minWidth: 0, pr: { lg: 1 } }}>
            <Stack direction="row" spacing={1} alignItems="center" mb={1}>
              <Box
                sx={{
                  width: 34,
                  height: 34,
                  borderRadius: '50%',
                  display: 'grid',
                  placeItems: 'center',
                  flexShrink: 0,
                  color: s.color,
                  bgcolor: alpha(s.color, 0.12),
                  border: `1px solid ${alpha(s.color, 0.4)}`,
                  '& svg': { fontSize: 18 },
                }}
              >
                {s.icon}
              </Box>
              <Typography variant="caption" color="text.disabled" fontWeight={700}>
                {String(i + 1).padStart(2, '0')}
              </Typography>
            </Stack>
            <Typography variant="subtitle2" fontWeight={700} sx={{ lineHeight: 1.3, mb: 0.5 }}>
              {s.title}
            </Typography>
            <Typography
              variant="caption"
              color="text.secondary"
              component="p"
              sx={{ lineHeight: 1.45, m: 0 }}
            >
              {s.detail}
            </Typography>
            {s.live && (
              <Typography
                variant="caption"
                component="p"
                sx={{ mt: 0.75, mb: 0, color: s.color, fontWeight: 600, fontSize: '0.7rem' }}
              >
                {s.live}
              </Typography>
            )}
          </Box>
          {i < all.length - 1 && (
            <ArrowIcon
              sx={{
                display: { xs: 'none', lg: 'block' },
                alignSelf: 'flex-start',
                mt: '7px',
                mx: 0.25,
                color: 'text.disabled',
              }}
              aria-hidden
            />
          )}
        </Box>
      ))}
    </Box>
  </Paper>
)

export default PipelineLineage

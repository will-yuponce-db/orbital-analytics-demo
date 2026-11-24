import React from 'react'
import { Box, Chip, Container, Grid, Paper, Stack, Typography } from '@mui/material'
import {
  SatelliteAlt as SatelliteIcon,
  Verified as RealIcon,
  Science as SimulatedIcon,
  Psychology as ModelIcon,
  Keyboard as KeyboardIcon,
  Rule as LimitsIcon,
} from '@mui/icons-material'
import { TIER_COLOR } from '../utils/riskStyle'

const DEFINITIONS: { term: string; text: React.ReactNode }[] = [
  {
    term: 'TCA',
    text: 'Time of closest approach, from the latest CDM for the event. All times are UTC.',
  },
  { term: 'Miss distance', text: 'Predicted minimum range between the two objects at TCA.' },
  {
    term: 'Pc (18 SDS)',
    text: 'Probability of collision reported in the CDM by the 18th Space Defense Squadron. OrbitWatch does not recompute it; risk tiers and maneuver advice use this value.',
  },
  {
    term: 'Pc (ML)',
    text: 'An XGBoost estimate of Pc from encounter and object features, trained on CDM history. Shown for comparison, never as a replacement.',
  },
  {
    term: 'CDM updates',
    text: 'Space-Track issues several CDMs per event as the orbit solutions improve, in both object orderings. Each card is one event; its Pc trend runs from the first CDM to the latest.',
  },
  {
    term: 'Risk tier',
    text: (
      <>
        <Box component="span" sx={{ color: TIER_COLOR.red, fontWeight: 700 }}>
          Red
        </Box>{' '}
        above 1×10⁻³,{' '}
        <Box component="span" sx={{ color: TIER_COLOR.amber, fontWeight: 700 }}>
          amber
        </Box>{' '}
        1×10⁻⁴ to 1×10⁻³,{' '}
        <Box component="span" sx={{ color: TIER_COLOR.green, fontWeight: 700 }}>
          green
        </Box>{' '}
        below 1×10⁻⁴, on the 18 SDS Pc.
      </>
    ),
  },
  {
    term: 'Maneuver window',
    text: 'For events above 1×10⁻⁴: from TCA minus 48 h to TCA minus 6 h. After TCA, or once the window closes, no maneuver advice is shown.',
  },
]

const SHORTCUTS: [string, string][] = [
  ['⌘K / Ctrl+K', 'Search the scenario library'],
  ['M', 'Orbital elements'],
  ['A', 'AI analyst'],
  ['C', 'Conjunction list'],
  ['X', 'Anomalies'],
  ['T', 'Event playback'],
]

const Section: React.FC<{ icon: React.ReactNode; title: string; children: React.ReactNode }> = ({
  icon,
  title,
  children,
}) => (
  <Paper elevation={1} sx={{ p: 3, height: '100%', border: '1px solid rgba(255,255,255,0.08)' }}>
    <Stack direction="row" spacing={1} alignItems="center" mb={1.5} sx={{ color: 'primary.light' }}>
      {icon}
      <Typography variant="h6" fontWeight={700} color="text.primary">
        {title}
      </Typography>
    </Stack>
    {children}
  </Paper>
)

const About: React.FC = () => (
  <Container maxWidth="lg">
    <Box sx={{ my: 4 }}>
      <Stack direction="row" spacing={2} alignItems="center" sx={{ mb: 1 }}>
        <SatelliteIcon sx={{ fontSize: 44, color: 'primary.light' }} />
        <Box>
          <Typography variant="h4" component="h1" fontWeight={700}>
            About OrbitWatch
          </Typography>
          <Typography variant="body1" color="text.secondary">
            Conjunction assessment on Space-Track data, built on Databricks
          </Typography>
        </Box>
      </Stack>

      <Typography variant="body1" sx={{ mt: 3, mb: 3, maxWidth: 900 }}>
        OrbitWatch ingests the public Space-Track conjunction data messages (CDMs) and GP element
        sets, groups CDM updates into events, scores each CDM with an XGBoost model, and serves the
        results to this app from Lakebase. Operators triage by risk tier, inspect the geometry in
        3D, and ask an assistant that answers from the live data. It is decision support: screening
        and notifications remain with 18 SDS.
      </Typography>

      <Grid container spacing={2.5}>
        <Grid item xs={12}>
          <Section icon={<ModelIcon />} title="Definitions">
            <Box
              component="dl"
              sx={{
                m: 0,
                display: 'grid',
                gridTemplateColumns: { xs: '1fr', sm: '180px 1fr' },
                columnGap: 3,
                rowGap: 1.25,
                '& dt': { fontWeight: 700 },
                '& dd': { m: 0, color: 'text.secondary', mb: { xs: 1, sm: 0 } },
              }}
            >
              {DEFINITIONS.map(d => (
                <React.Fragment key={d.term}>
                  <Typography component="dt" variant="body2">
                    {d.term}
                  </Typography>
                  <Typography component="dd" variant="body2">
                    {d.text}
                  </Typography>
                </React.Fragment>
              ))}
            </Box>
          </Section>
        </Grid>

        <Grid item xs={12} md={6}>
          <Section icon={<RealIcon />} title="Data provenance">
            <Stack spacing={1.5}>
              <Box>
                <Chip
                  size="small"
                  label="REAL"
                  color="success"
                  variant="outlined"
                  sx={{ fontWeight: 700, mb: 0.75 }}
                />
                <Typography variant="body2" color="text.secondary">
                  Conjunctions, TCAs, miss distances, Pc (18 SDS) and the object catalog come from
                  Space-Track. Orbits in the 3D view are SGP4 propagations of the published GP
                  element sets.
                </Typography>
              </Box>
              <Box>
                <Chip
                  size="small"
                  label="MODEL"
                  color="info"
                  variant="outlined"
                  sx={{ fontWeight: 700, mb: 0.75 }}
                />
                <Typography variant="body2" color="text.secondary">
                  Pc (ML) and the risk tier changes in ML Insights come from the XGBoost model
                  registered in Unity Catalog. Its test metrics are shown with the predictions.
                </Typography>
              </Box>
              <Box>
                <Chip
                  size="small"
                  icon={<SimulatedIcon />}
                  label="SIMULATED"
                  variant="outlined"
                  sx={{ fontWeight: 700, mb: 0.75, color: 'text.secondary' }}
                />
                <Typography variant="body2" color="text.secondary">
                  Anomaly events are simulated on real catalog objects to show the triage workflow;
                  no live detector runs behind them. The tracking network panel is a reference
                  sensor list.
                </Typography>
              </Box>
            </Stack>
          </Section>
        </Grid>

        <Grid item xs={12} md={6}>
          <Section icon={<LimitsIcon />} title="Limitations">
            <Stack component="ul" spacing={1} sx={{ m: 0, pl: 2.5, color: 'text.secondary' }}>
              <Typography component="li" variant="body2">
                Public CDMs carry no covariance or state vectors, so Pc cannot be recomputed here.
              </Typography>
              <Typography component="li" variant="body2">
                GP element sets with SGP4 have kilometer-level error. The 3D view is for
                orientation, not screening.
              </Typography>
              <Typography component="li" variant="body2">
                Pc (ML) is experimental. Check the model skill in ML Insights before relying on it.
              </Typography>
              <Typography component="li" variant="body2">
                Data is as fresh as the last pipeline run; the header shows the age of the newest
                CDM.
              </Typography>
              <Typography component="li" variant="body2">
                Assistant answers come from tool calls on the same data and should be reviewed
                before acting.
              </Typography>
            </Stack>
          </Section>
        </Grid>

        <Grid item xs={12}>
          <Section icon={<KeyboardIcon />} title="Keyboard shortcuts">
            <Stack direction="row" spacing={3} flexWrap="wrap" useFlexGap>
              {SHORTCUTS.map(([key, what]) => (
                <Stack key={key} direction="row" spacing={1} alignItems="center">
                  <Box
                    component="kbd"
                    sx={{
                      px: 0.75,
                      py: 0.25,
                      borderRadius: 0.75,
                      border: '1px solid rgba(255,255,255,0.25)',
                      fontFamily: 'inherit',
                      fontSize: '0.75rem',
                      fontWeight: 700,
                    }}
                  >
                    {key}
                  </Box>
                  <Typography variant="body2" color="text.secondary">
                    {what}
                  </Typography>
                </Stack>
              ))}
            </Stack>
            <Typography variant="caption" color="text.disabled" display="block" sx={{ mt: 1 }}>
              Panel shortcuts work on an event page.
            </Typography>
          </Section>
        </Grid>
      </Grid>
    </Box>
  </Container>
)

export default About

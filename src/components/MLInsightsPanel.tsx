import React, { useEffect, useState } from 'react'
import {
  Alert,
  Box,
  Chip,
  CircularProgress,
  LinearProgress,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Tooltip,
  Typography,
} from '@mui/material'
import {
  CartesianGrid,
  ReferenceLine,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip as ChartTooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { Psychology as ModelIcon, SwapVert as ChangedIcon } from '@mui/icons-material'
import { api, type MlPrediction, type MlSummary } from '../services/api'
import { formatInt, formatPc, formatUtc, prettyFeatureName } from '../utils/format'
import { TIER_COLOR, asTier } from '../utils/riskStyle'
import PcValue from './PcValue'

const SURFACE = '#141b2d'
const POINT = '#4fc3f7'
const LOW_SKILL_R2 = 0.3

const SUPER: Record<string, string> = {
  '-': '⁻',
  '0': '⁰',
  '1': '¹',
  '2': '²',
  '3': '³',
  '4': '⁴',
  '5': '⁵',
  '6': '⁶',
  '7': '⁷',
  '8': '⁸',
  '9': '⁹',
}
const powLabel = (exp: number) =>
  `10${String(exp)
    .split('')
    .map(c => SUPER[c] ?? c)
    .join('')}`

interface Point {
  x: number
  y: number
  pair: string
  rawPc: number
  mlPc: number
  changed: boolean
}

const Metric: React.FC<{ label: string; value: React.ReactNode; hint: string }> = ({
  label,
  value,
  hint,
}) => (
  <Tooltip title={hint} disableInteractive>
    <Box sx={{ cursor: 'help', minWidth: 0 }}>
      <Typography variant="caption" color="text.secondary" display="block" noWrap>
        {label}
      </Typography>
      <Typography variant="body2" fontWeight={600} noWrap>
        {value}
      </Typography>
    </Box>
  </Tooltip>
)

const TierText: React.FC<{ tier: string | null }> = ({ tier }) => {
  if (!tier) return <>n/a</>
  const t = asTier(tier)
  return (
    <Box
      component="span"
      sx={{
        color: TIER_COLOR[t],
        fontWeight: 700,
        textTransform: 'uppercase',
        fontSize: '0.68rem',
      }}
    >
      {t}
    </Box>
  )
}

/** Raw (18 SDS) vs ML Pc on log axes, with the y = x line where the model agrees. */
const CalibrationScatter: React.FC<{ predictions: MlPrediction[] }> = ({ predictions }) => {
  const points: Point[] = predictions
    .filter(p => p.rawPc != null && p.mlPc != null && p.rawPc > 0 && p.mlPc > 0)
    .map(p => ({
      x: Math.log10(p.rawPc as number),
      y: Math.log10(p.mlPc as number),
      pair: `${p.sat1} × ${p.sat2}`,
      rawPc: p.rawPc as number,
      mlPc: p.mlPc as number,
      changed: p.riskChanged,
    }))
  if (points.length < 3) return null
  const all = points.flatMap(p => [p.x, p.y])
  const lo = Math.floor(Math.min(...all))
  const hi = Math.max(lo + 1, Math.ceil(Math.max(...all)))
  const ticks = Array.from({ length: hi - lo + 1 }, (_, i) => lo + i)

  return (
    <Box sx={{ px: 1.5, pb: 1 }}>
      <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 0.5 }}>
        ML vs 18 SDS Pc, {points.length} CDMs. Points on the line mean the model agrees with the
        CDM.
      </Typography>
      <Box
        sx={{ height: 190 }}
        role="img"
        aria-label={`Scatter of ML Pc against 18 SDS Pc for ${points.length} CDMs, log scale`}
      >
        <ResponsiveContainer width="100%" height="100%">
          <ScatterChart margin={{ top: 8, right: 12, bottom: 18, left: 0 }}>
            <CartesianGrid stroke="rgba(255,255,255,0.07)" strokeDasharray="0" />
            <XAxis
              type="number"
              dataKey="x"
              domain={[lo, hi]}
              ticks={ticks}
              tickFormatter={powLabel}
              tick={{ fill: 'rgba(255,255,255,0.55)', fontSize: 11 }}
              stroke="rgba(255,255,255,0.15)"
              label={{
                value: 'Pc (18 SDS)',
                position: 'insideBottom',
                offset: -10,
                fill: 'rgba(255,255,255,0.55)',
                fontSize: 11,
              }}
            />
            <YAxis
              type="number"
              dataKey="y"
              domain={[lo, hi]}
              ticks={ticks}
              tickFormatter={powLabel}
              tick={{ fill: 'rgba(255,255,255,0.55)', fontSize: 11 }}
              stroke="rgba(255,255,255,0.15)"
              width={44}
              label={{
                value: 'Pc (ML)',
                angle: -90,
                position: 'insideLeft',
                offset: 12,
                fill: 'rgba(255,255,255,0.55)',
                fontSize: 11,
              }}
            />
            <ReferenceLine
              segment={[
                { x: lo, y: lo },
                { x: hi, y: hi },
              ]}
              stroke="rgba(255,255,255,0.35)"
              strokeWidth={1}
              ifOverflow="hidden"
            />
            <ChartTooltip
              cursor={false}
              content={({ active, payload }) => {
                const p = active && (payload?.[0]?.payload as Point | undefined)
                if (!p) return null
                return (
                  <Paper sx={{ p: 1, border: '1px solid rgba(255,255,255,0.15)' }}>
                    <Typography variant="caption" fontWeight={700} display="block">
                      {p.pair}
                    </Typography>
                    <Typography variant="caption" color="text.secondary" display="block">
                      18 SDS {formatPc(p.rawPc)}, ML {formatPc(p.mlPc)}
                    </Typography>
                    {p.changed && (
                      <Typography variant="caption" color="warning.main" display="block">
                        Risk tier changed
                      </Typography>
                    )}
                  </Paper>
                )
              }}
            />
            <Scatter
              data={points}
              isAnimationActive={false}
              shape={(props: { cx?: number; cy?: number }) => (
                <g>
                  <circle cx={props.cx} cy={props.cy} r={12} fill="transparent" />
                  <circle
                    cx={props.cx}
                    cy={props.cy}
                    r={4}
                    fill={POINT}
                    stroke={SURFACE}
                    strokeWidth={2}
                  />
                </g>
              )}
            />
          </ScatterChart>
        </ResponsiveContainer>
      </Box>
    </Box>
  )
}

interface MLInsightsPanelProps {
  /** Unused; predictions cover all scored CDMs. Kept for call-site compatibility. */
  noradIds?: string[]
}

const MLInsightsPanel: React.FC<MLInsightsPanelProps> = () => {
  const [state, setState] = useState<{
    summary: MlSummary | null
    predictions: MlPrediction[]
    failed: boolean
  } | null>(null)

  useEffect(() => {
    let cancelled = false
    Promise.allSettled([api.getMlSummary(), api.getMlPredictions(50)]).then(([s, p]) => {
      if (cancelled) return
      setState({
        summary: s.status === 'fulfilled' ? s.value : null,
        predictions: p.status === 'fulfilled' ? p.value : [],
        failed: s.status === 'rejected' && p.status === 'rejected',
      })
    })
    return () => {
      cancelled = true
    }
  }, [])

  if (!state) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}>
        <CircularProgress size={32} />
      </Box>
    )
  }

  const { summary, predictions, failed } = state
  if (!summary && predictions.length === 0) {
    return (
      <Box sx={{ p: 3, textAlign: 'center' }}>
        <ModelIcon sx={{ fontSize: 44, color: 'text.disabled', mb: 1 }} />
        <Typography variant="subtitle2" fontWeight={700} gutterBottom>
          {failed ? 'Model results unavailable' : 'No model results yet'}
        </Typography>
        <Typography variant="body2" color="text.secondary">
          {failed
            ? 'The ML endpoints did not respond. Pc (18 SDS) values from the CDMs are unaffected.'
            : 'Run the ML train and score job to publish a model summary and predictions. Pc (18 SDS) values from the CDMs are unaffected.'}
        </Typography>
      </Box>
    )
  }

  const features = summary?.topFeatures ?? []
  const maxImportance = Math.max(...features.map(f => f.importance), 0)
  const lowSkill = summary?.r2 != null && summary.r2 < LOW_SKILL_R2
  const changed = predictions.filter(p => p.riskChanged)
  const ordered = [...changed, ...predictions.filter(p => !p.riskChanged)]

  return (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column', overflow: 'auto' }}>
      {summary && (
        <Paper variant="outlined" sx={{ m: 1.5, p: 1.5 }}>
          <Stack direction="row" alignItems="center" spacing={1} mb={0.25}>
            <ModelIcon sx={{ fontSize: 18, color: POINT }} />
            <Typography variant="subtitle2" fontWeight={700} noWrap>
              {summary.modelName ?? 'XGBoost Pc model'}
              {summary.modelVersion ? ` v${summary.modelVersion.replace(/^v/i, '')}` : ''}
            </Typography>
            <Chip
              label="XGBOOST"
              size="small"
              sx={{ height: 16, fontSize: '0.58rem', fontWeight: 700 }}
            />
          </Stack>
          <Typography variant="caption" color="text.secondary" display="block" mb={1.25}>
            Estimates Pc from encounter and object features. Shown next to the 18 SDS Pc for
            comparison, not as a replacement.
            {summary.trainedAt ? ` Trained ${formatUtc(summary.trainedAt)}.` : ''}
          </Typography>

          {lowSkill && (
            <Alert
              severity="warning"
              variant="outlined"
              sx={{ mb: 1.25, py: 0, '& .MuiAlert-message': { fontSize: '0.75rem' } }}
            >
              Low model skill: R{'²'} {summary.r2?.toFixed(2)} on log Pc. Treat Pc (ML) as
              experimental.
            </Alert>
          )}

          <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 1, mb: 1.25 }}>
            <Metric
              label={'R² (log Pc)'}
              value={summary.r2 != null ? summary.r2.toFixed(3) : 'n/a'}
              hint="Coefficient of determination on the held-out test set, computed on the log-transformed target"
            />
            <Metric
              label="MAE"
              value={formatPc(summary.mae)}
              hint="Mean absolute error in Pc on the test set"
            />
            <Metric
              label="RMSE"
              value={formatPc(summary.rmse)}
              hint="Root mean squared error in Pc on the test set"
            />
            <Metric
              label="Training"
              value={`${formatInt(summary.nTraining)} CDMs`}
              hint="Samples used to fit the model"
            />
            <Metric
              label="Test"
              value={`${formatInt(summary.nTest)} CDMs`}
              hint="Held-out samples used for the metrics above"
            />
            <Metric
              label="Features"
              value={formatInt(summary.nFeatures)}
              hint="Model input features"
            />
            <Metric
              label="Scored"
              value={`${formatInt(summary.totalScored)} CDMs`}
              hint="CDMs scored by this model version"
            />
            <Metric
              label="Tier changes"
              value={formatInt(summary.riskChanges)}
              hint="Scored CDMs whose risk tier differs between ML Pc and 18 SDS Pc"
            />
            <Metric
              label="ML / 18 SDS"
              value={
                summary.meanCalibrationRatio != null
                  ? `${summary.meanCalibrationRatio.toFixed(2)}×`
                  : 'n/a'
              }
              hint="Mean ratio of ML Pc to 18 SDS Pc across scored CDMs"
            />
          </Box>

          {features.length > 0 && (
            <>
              <Typography
                variant="caption"
                color="text.secondary"
                sx={{ mb: 0.5, display: 'block' }}
              >
                Top features by importance
              </Typography>
              {features.map(f => (
                <Box key={f.name} sx={{ mb: 0.75 }}>
                  <Stack direction="row" justifyContent="space-between">
                    <Typography variant="caption" sx={{ fontSize: '0.72rem' }}>
                      {prettyFeatureName(f.name)}
                    </Typography>
                    <Typography variant="caption" sx={{ fontSize: '0.72rem' }} fontWeight={600}>
                      {(f.importance * 100).toFixed(1)}%
                    </Typography>
                  </Stack>
                  <LinearProgress
                    variant="determinate"
                    value={maxImportance > 0 ? (f.importance / maxImportance) * 100 : 0}
                    aria-label={`${prettyFeatureName(f.name)} importance ${(f.importance * 100).toFixed(1)} percent`}
                    sx={{
                      height: 5,
                      borderRadius: 1,
                      bgcolor: 'rgba(255,255,255,0.06)',
                      '& .MuiLinearProgress-bar': { bgcolor: POINT },
                    }}
                  />
                </Box>
              ))}
              {maxImportance === 0 && (
                <Typography variant="caption" color="text.disabled" display="block">
                  All reported importances are zero; the model is not using its inputs.
                </Typography>
              )}
            </>
          )}
        </Paper>
      )}

      {predictions.length > 0 && (
        <>
          <CalibrationScatter predictions={predictions} />
          <Stack
            direction="row"
            alignItems="baseline"
            spacing={1}
            sx={{ px: 1.5, pt: 0.5, pb: 0.5 }}
          >
            <Typography variant="subtitle2" fontWeight={600}>
              Scored CDMs
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {changed.length > 0
                ? `${changed.length} with a tier change listed first`
                : 'no tier changes in this sample'}
            </Typography>
          </Stack>
          <TableContainer sx={{ flexShrink: 0 }}>
            <Table size="small" stickyHeader>
              <TableHead>
                <TableRow>
                  <TableCell>Pair</TableCell>
                  <TableCell>18 SDS</TableCell>
                  <TableCell>ML</TableCell>
                  <TableCell>Tier</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {ordered.map((p, i) => (
                  <TableRow key={`${p.cdmId}-${i}`} hover>
                    <TableCell sx={{ maxWidth: 140 }}>
                      <Typography
                        variant="caption"
                        fontWeight={500}
                        noWrap
                        display="block"
                        title={p.sat1}
                      >
                        {p.sat1}
                      </Typography>
                      <Typography
                        variant="caption"
                        color="text.secondary"
                        noWrap
                        display="block"
                        title={p.sat2}
                      >
                        {'×'} {p.sat2}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <PcValue pc={p.rawPc} variant="caption" />
                    </TableCell>
                    <TableCell>
                      <PcValue pc={p.mlPc} variant="caption" fontWeight={700} />
                      {p.ratio != null && (
                        <Typography
                          variant="caption"
                          color="text.disabled"
                          display="block"
                          sx={{ fontSize: '0.66rem' }}
                        >
                          {p.ratio >= 1
                            ? `${p.ratio.toFixed(1)}× higher`
                            : `${(1 / p.ratio).toFixed(1)}× lower`}
                        </Typography>
                      )}
                    </TableCell>
                    <TableCell>
                      <Stack direction="row" spacing={0.5} alignItems="center">
                        {p.riskChanged ? (
                          <Tooltip title="ML tier differs from the 18 SDS tier">
                            <Stack direction="row" spacing={0.25} alignItems="center">
                              <TierText tier={p.rawTier} />
                              <ChangedIcon
                                sx={{ fontSize: 13, color: 'warning.main' }}
                                aria-label="changed to"
                              />
                              <TierText tier={p.mlTier} />
                            </Stack>
                          </Tooltip>
                        ) : (
                          <TierText tier={p.mlTier} />
                        )}
                      </Stack>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </>
      )}
    </Box>
  )
}

export default MLInsightsPanel

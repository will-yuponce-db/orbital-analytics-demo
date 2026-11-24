import React from 'react'
import { Box, Tooltip, Typography, type TypographyProps } from '@mui/material'
import { formatPc, formatPcOdds, pcParts } from '../utils/format'

interface PcValueProps extends Omit<TypographyProps, 'children'> {
  pc: number | null | undefined
  /** Show "1 in N" odds on hover. */
  showOdds?: boolean
}

/** Probability of collision in scientific notation, e.g. 6.7×10⁻⁴. */
const PcValue: React.FC<PcValueProps> = ({ pc, showOdds = true, sx, ...typography }) => {
  const parts = pcParts(pc)
  const body = parts ? (
    <>
      {parts.mantissa}
      {'×'}10
      <Box component="sup" sx={{ fontSize: '0.7em', lineHeight: 0, ml: '1px' }}>
        {String(parts.exponent).replace('-', '−')}
      </Box>
    </>
  ) : pc === 0 ? (
    '0'
  ) : (
    'n/a'
  )

  const value = (
    <Typography
      component="span"
      {...typography}
      sx={[
        { fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' },
        ...(Array.isArray(sx) ? sx : [sx]),
      ]}
      aria-label={parts ? formatPc(pc) : undefined}
    >
      {body}
    </Typography>
  )

  if (!showOdds || !parts) return value
  return (
    <Tooltip title={`${formatPc(pc)} (${formatPcOdds(pc)})`} placement="top" disableInteractive>
      {value}
    </Tooltip>
  )
}

export default PcValue

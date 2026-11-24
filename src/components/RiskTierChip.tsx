import React from 'react'
import { Chip, Tooltip } from '@mui/material'
import { alpha } from '@mui/material/styles'
import {
  ReportOutlined as RedIcon,
  WarningAmberOutlined as AmberIcon,
  CheckCircleOutline as GreenIcon,
} from '@mui/icons-material'
import type { RiskTier } from '../utils/conjunctions'
import { TIER_RULES } from '../utils/conjunctions'
import { PASSED_COLOR, TIER_COLOR, TIER_LABEL } from '../utils/riskStyle'

const ICON: Record<RiskTier, typeof RedIcon> = { red: RedIcon, amber: AmberIcon, green: GreenIcon }

interface RiskTierChipProps {
  tier: RiskTier
  /** Grey styling for events whose TCA has passed. */
  muted?: boolean
  size?: 'small' | 'medium'
}

/** Risk tier as icon plus text, never color alone. */
const RiskTierChip: React.FC<RiskTierChipProps> = ({ tier, muted = false, size = 'small' }) => {
  const color = muted ? PASSED_COLOR : TIER_COLOR[tier]
  const Icon = ICON[tier]
  return (
    <Tooltip title={`${TIER_LABEL[tier]} tier: 18 SDS ${TIER_RULES[tier]}`} disableInteractive>
      <Chip
        size={size}
        icon={
          <Icon
            sx={{
              fontSize: size === 'small' ? '14px !important' : undefined,
              color: `${color} !important`,
            }}
          />
        }
        label={TIER_LABEL[tier].toUpperCase()}
        sx={{
          height: size === 'small' ? 22 : undefined,
          fontWeight: 700,
          fontSize: size === 'small' ? '0.66rem' : '0.75rem',
          letterSpacing: 0.6,
          color,
          bgcolor: alpha(color, 0.14),
          border: `1px solid ${alpha(color, 0.45)}`,
        }}
      />
    </Tooltip>
  )
}

export default RiskTierChip

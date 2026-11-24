import type { ConjunctionView } from './conjunctions'
import { formatMissDistance, formatPcPlain, formatUtc } from './format'

/**
 * Tiny event bus so any view can open the assistant drawer (AlertFAB) and
 * optionally hand it a prompt to send.
 */
export const ASSISTANT_EVENT = 'orbitwatch:assistant'

export interface AssistantRequest {
  tab?: 'chat' | 'alerts'
  /** Sent as a user message as soon as the drawer opens. */
  prompt?: string
}

export function openAssistant(request: AssistantRequest = {}) {
  window.dispatchEvent(new CustomEvent<AssistantRequest>(ASSISTANT_EVENT, { detail: request }))
}

function describe(e: ConjunctionView): string {
  const a = e.satelliteA
  const b = e.satelliteB
  return (
    `CDM ${e.cdmId}: ${a.name} (NORAD ${a.noradId}) and ${b.name} (NORAD ${b.noradId}), ` +
    `TCA ${formatUtc(e.tca, { seconds: true })}, 18 SDS Pc ${formatPcPlain(e.rawPc)}, ML Pc ${formatPcPlain(e.mlPc)}, ` +
    `miss distance ${formatMissDistance(e.missDistanceM)}, ${e.cdmCount} CDM update${e.cdmCount === 1 ? '' : 's'}`
  )
}

/** Prompt asking the assistant to size an avoidance maneuver for an event. */
export function maneuverPrompt(e: ConjunctionView): string {
  return `Plan a collision avoidance maneuver for conjunction ${describe(e)}. Compare in-track and radial options and give the post-maneuver Pc for each.`
}

/** Prompt asking the assistant for an assessment of an event. */
export function analysisPrompt(e: ConjunctionView): string {
  return `Assess conjunction ${describe(e)}. How does the risk compare with other upcoming events, and what should the operator do next?`
}

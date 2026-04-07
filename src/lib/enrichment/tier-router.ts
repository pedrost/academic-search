/**
 * Tier Router
 *
 * Dispatches an enrichment job to the correct tier implementation.
 * All tiers return the same FreeTierResult shape for uniform handling.
 */

import { freeTierEnrich, type EnrichmentContext, type FreeTierResult } from './free-tier'
import { apiTierEnrich } from './api-tier'
import { aiTierEnrich } from './ai-tier'

export type EnrichmentTier = 'FREE' | 'API' | 'AI'

export interface TieredEnrichJobData {
  academicId: string
  tier: EnrichmentTier
  context: EnrichmentContext
}

export async function routeEnrichment(job: TieredEnrichJobData): Promise<FreeTierResult> {
  const { academicId, tier, context } = job

  switch (tier) {
    case 'FREE':
      return freeTierEnrich(academicId, context)
    case 'API':
      return apiTierEnrich(academicId, context)
    case 'AI': {
      const result = await aiTierEnrich(academicId, context)
      // Strip the extra academicId field to match FreeTierResult shape
      const { academicId: _resolved, ...rest } = result
      return rest
    }
    default:
      throw new Error(`Unknown enrichment tier: ${tier}`)
  }
}

/** Estimate cost string for display */
export function estimateCost(tier: EnrichmentTier, count = 1): string {
  const perAcademic: Record<EnrichmentTier, number> = {
    FREE: 0.001,
    API: 0.012,
    AI: 0.20,
  }
  const total = perAcademic[tier] * count
  if (total < 0.01) return `~$${(total).toFixed(4)}`
  if (total < 1) return `~$${total.toFixed(3)}`
  if (total < 10) return `~$${total.toFixed(2)}`
  return `~$${Math.round(total).toLocaleString()}`
}

/** Estimate wall time in seconds for a single academic */
export function estimateSecondsPerAcademic(tier: EnrichmentTier): { min: number; max: number } {
  const times: Record<EnrichmentTier, { min: number; max: number }> = {
    FREE: { min: 30, max: 300 },
    API: { min: 5, max: 30 },
    AI: { min: 120, max: 300 },
  }
  return times[tier]
}

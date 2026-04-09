import { prisma } from '@/lib/db'

export type AIFeature = 'extraction' | 'insights' | 'search_ai' | 'calendar_events'

export async function isAIEnabled(
  organizationId: string,
  feature: AIFeature,
): Promise<boolean> {
  if (process.env.AI_EXTRACTION_ENABLED !== 'true') {
    return false
  }

  const settings = await prisma.organizationAISettings.findUnique({
    where: { organization_id: organizationId },
  })

  if (!settings) return false
  if (settings.kill_switch) return false
  if (settings.ai_mode === 'OFF') return false

  if (settings.ai_mode === 'SHADOW' || settings.ai_mode === 'LIVE') {
    return true
  }

  if (settings.ai_mode === 'BETA') {
    return settings.beta_features.includes(feature)
  }

  return false
}

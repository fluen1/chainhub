'use server'

import { processMessage } from '@/lib/ai/assistant/orchestrator'
import { toolRegistry } from '@/lib/ai/assistant/tools/registry'
import { checkCostCap } from '@/lib/ai/cost-cap'
import { isAIEnabled } from '@/lib/ai/feature-flags'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { captureError } from '@/lib/logger'
import type { ActionResult } from '@/types/actions'

export interface SendMessageResult {
  response: string
  toolResults: Array<{ toolName: string; displayText: string }>
  pendingActions: Array<{
    id: string
    actionType: string
    actionLabel: string
    payload: Record<string, unknown>
  }>
}

// ─────────────────────────────────────────────────────────────────────────────
// sendMessage — send en besked til assistenten og få svar
// ─────────────────────────────────────────────────────────────────────────────
export async function sendMessage(input: {
  conversationId: string
  message: string
}): Promise<ActionResult<SendMessageResult>> {
  const session = await auth()
  if (!session) return { error: 'Din session er udløbet — log ind igen.' }

  const enabled = await isAIEnabled(session.user.organizationId, 'assistant')
  if (!enabled) return { error: 'AI-assistenten er ikke aktiveret for din organisation.' }

  // Verificér at samtalen tilhører brugerens organisation
  const conversation = await prisma.conversation.findFirst({
    where: {
      id: input.conversationId,
      organization_id: session.user.organizationId,
    },
  })
  if (!conversation) return { error: 'Samtalen blev ikke fundet.' }

  // Cost-cap-håndhævelse (Option B): afvis FØR LLM-kald hvis månedlig AI-cap er nået.
  const capCheck = await checkCostCap(session.user.organizationId)
  if (!capCheck.allowed) {
    return { error: capCheck.reason ?? 'Månedlig AI-cap er nået — kontakt admin' }
  }

  try {
    const result = await processMessage({
      conversationId: input.conversationId,
      userMessage: input.message,
      organizationId: session.user.organizationId,
      userId: session.user.id,
    })

    return {
      data: {
        response: result.response,
        toolResults: result.toolResults.map((tr) => ({
          toolName: tr.toolName,
          displayText: tr.result.displayText ?? '',
        })),
        pendingActions: result.pendingActions,
      },
    }
  } catch (err) {
    captureError(err, {
      namespace: 'action:assistant',
      extra: { conversationId: input.conversationId },
    })
    return { error: 'Noget gik galt — prøv igen.' }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// createConversation — opret en ny samtale
// ─────────────────────────────────────────────────────────────────────────────
export async function createConversation(): Promise<ActionResult<{ id: string }>> {
  const session = await auth()
  if (!session) return { error: 'Din session er udløbet — log ind igen.' }

  const enabled = await isAIEnabled(session.user.organizationId, 'assistant')
  if (!enabled) return { error: 'AI-assistenten er ikke aktiveret for din organisation.' }

  try {
    const conversation = await prisma.conversation.create({
      data: {
        user_id: session.user.id,
        organization_id: session.user.organizationId,
      },
    })

    return { data: { id: conversation.id } }
  } catch (err) {
    captureError(err, { namespace: 'action:assistant', extra: {} })
    return { error: 'Noget gik galt — prøv igen.' }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// confirmAction — bekræft en afventende handling
// ─────────────────────────────────────────────────────────────────────────────
export async function confirmAction(actionId: string): Promise<ActionResult<{ success: boolean }>> {
  const session = await auth()
  if (!session) return { error: 'Din session er udløbet — log ind igen.' }

  const enabled = await isAIEnabled(session.user.organizationId, 'assistant')
  if (!enabled) return { error: 'AI-assistenten er ikke aktiveret for din organisation.' }

  // Find PendingAction og verificér org-ejerskab via conversation
  const pendingAction = await prisma.pendingAction.findFirst({
    where: {
      id: actionId,
      status: 'PENDING',
      conversation: {
        organization_id: session.user.organizationId,
      },
    },
    include: { conversation: true },
  })

  if (!pendingAction) return { error: 'Handlingen blev ikke fundet eller er allerede behandlet.' }

  // Udfør toolet
  const tool = toolRegistry.get(pendingAction.action_type)
  if (!tool) return { error: 'Ukendt handlingstype — kontakt support.' }

  try {
    await tool.execute(pendingAction.payload as Record<string, unknown>, {
      organizationId: session.user.organizationId,
      userId: session.user.id,
    })

    await prisma.pendingAction.update({
      where: { id: actionId },
      data: { status: 'CONFIRMED' },
    })

    return { data: { success: true } }
  } catch (err) {
    captureError(err, { namespace: 'action:assistant', extra: { actionId } })
    return { error: 'Noget gik galt — prøv igen.' }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// rejectAction — afvis en afventende handling
// ─────────────────────────────────────────────────────────────────────────────
export async function rejectAction(actionId: string): Promise<ActionResult<{ success: boolean }>> {
  const session = await auth()
  if (!session) return { error: 'Din session er udløbet — log ind igen.' }

  const enabled = await isAIEnabled(session.user.organizationId, 'assistant')
  if (!enabled) return { error: 'AI-assistenten er ikke aktiveret for din organisation.' }

  const pendingAction = await prisma.pendingAction.findFirst({
    where: {
      id: actionId,
      status: 'PENDING',
      conversation: {
        organization_id: session.user.organizationId,
      },
    },
  })

  if (!pendingAction) return { error: 'Handlingen blev ikke fundet eller er allerede behandlet.' }

  try {
    await prisma.pendingAction.update({
      where: { id: actionId },
      data: { status: 'REJECTED' },
    })

    return { data: { success: true } }
  } catch (err) {
    captureError(err, { namespace: 'action:assistant', extra: { actionId } })
    return { error: 'Noget gik galt — prøv igen.' }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// getConversationHistory — hent beskedhistorik for en samtale
// ─────────────────────────────────────────────────────────────────────────────
export async function getConversationHistory(
  conversationId: string
): Promise<ActionResult<Array<{ role: string; content: string; createdAt: Date }>>> {
  const session = await auth()
  if (!session) return { error: 'Din session er udløbet — log ind igen.' }

  const enabled = await isAIEnabled(session.user.organizationId, 'assistant')
  if (!enabled) return { error: 'AI-assistenten er ikke aktiveret for din organisation.' }

  const conversation = await prisma.conversation.findFirst({
    where: {
      id: conversationId,
      organization_id: session.user.organizationId,
    },
  })
  if (!conversation) return { error: 'Samtalen blev ikke fundet.' }

  try {
    const messages = await prisma.message.findMany({
      where: { conversation_id: conversationId },
      orderBy: { created_at: 'asc' },
    })

    return {
      data: messages.map((m) => ({
        role: m.role,
        content: m.content,
        createdAt: m.created_at,
      })),
    }
  } catch (err) {
    captureError(err, { namespace: 'action:assistant', extra: { conversationId } })
    return { error: 'Noget gik galt — prøv igen.' }
  }
}

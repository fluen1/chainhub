'use client'

import { useEffect, useRef, useState } from 'react'
import { Sparkles, X, Send } from 'lucide-react'
import { toast } from 'sonner'
import { sendMessage, createConversation } from '@/actions/assistant'
import { ActionConfirmCard } from './ActionConfirmCard'

interface PendingAction {
  id: string
  actionType: string
  actionLabel: string
  payload: Record<string, unknown>
}

interface Message {
  role: 'user' | 'assistant'
  content: string
  pendingActions?: PendingAction[]
}

interface Props {
  open: boolean
  onClose: () => void
}

export function ChatPanel({ open, onClose }: Props) {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [conversationId, setConversationId] = useState<string | null>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  // Opret samtale første gang panelet åbnes
  useEffect(() => {
    if (!open) return
    inputRef.current?.focus()

    if (conversationId) return

    async function init() {
      const result = await createConversation()
      if (result.error) {
        toast.error(result.error)
        return
      }
      setConversationId(result.data.id)
    }
    void init()
  }, [open, conversationId])

  // Auto-scroll til bunden ved nye beskeder
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, loading])

  // Escape lukker panelet
  useEffect(() => {
    if (!open) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [open, onClose])

  async function handleSend() {
    const text = input.trim()
    if (!text || loading || !conversationId) return

    setInput('')
    setMessages((prev) => [...prev, { role: 'user', content: text }])
    setLoading(true)

    const result = await sendMessage({ conversationId, message: text })
    setLoading(false)

    if (result.error) {
      toast.error(result.error)
      setMessages((prev) => [
        ...prev,
        { role: 'assistant', content: `Der opstod en fejl: ${result.error}` },
      ])
      return
    }

    setMessages((prev) => [
      ...prev,
      {
        role: 'assistant',
        content: result.data.response,
        pendingActions: result.data.pendingActions,
      },
    ])
  }

  if (!open) return null

  return (
    <div
      className="fixed bottom-0 right-0 top-0 z-50 flex w-[400px] flex-col border-l border-b-border bg-b-panel shadow-xl"
      role="dialog"
      aria-label="AI-assistent"
    >
      {/* Header */}
      <div className="flex h-12 shrink-0 items-center justify-between border-b border-b-border px-4">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-blue-500" aria-hidden />
          <span className="text-[13px] font-semibold text-b-1">AI-assistent</span>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="flex h-7 w-7 items-center justify-center rounded-[4px] text-b-2 hover:bg-b-surface-hover"
          aria-label="Luk AI-assistent"
        >
          <X className="h-4 w-4" aria-hidden />
        </button>
      </div>

      {/* Besked-område */}
      <div className="flex-1 overflow-y-auto p-4 text-[13px]">
        {messages.length === 0 && !loading && (
          <p className="text-b-2">
            Hej! Jeg kan hjælpe med at finde data om selskaber, kontrakter, sager og opgaver — eller
            oprette nye emner for dig.
          </p>
        )}

        {messages.map((msg, i) => (
          <div
            key={i}
            className={`mb-3 flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`max-w-[85%] rounded-lg px-3 py-2 ${
                msg.role === 'user' ? 'bg-blue-500 text-white' : 'bg-b-surface text-b-1'
              }`}
            >
              <p className="whitespace-pre-wrap">{msg.content}</p>
              {msg.pendingActions && msg.pendingActions.length > 0 && (
                <div className="mt-1">
                  {msg.pendingActions.map((action) => (
                    <ActionConfirmCard
                      key={action.id}
                      actionId={action.id}
                      actionType={action.actionType}
                      actionLabel={action.actionLabel}
                      payload={action.payload}
                    />
                  ))}
                </div>
              )}
            </div>
          </div>
        ))}

        {loading && (
          <div className="mb-3 flex justify-start">
            <div className="rounded-lg bg-b-surface px-3 py-2 text-b-2">Tænker...</div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input-område */}
      <div className="shrink-0 border-t border-b-border p-3">
        <div className="flex items-center gap-2">
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                void handleSend()
              }
            }}
            placeholder="Stil et spørgsmål..."
            disabled={loading || !conversationId}
            className="flex-1 rounded-[4px] border border-b-border bg-white px-2.5 py-1.5 text-[13px] text-b-1 placeholder:text-b-3 focus:border-blue-400 focus:outline-none disabled:opacity-60"
          />
          <button
            type="button"
            onClick={() => void handleSend()}
            disabled={!input.trim() || loading || !conversationId}
            className="flex h-8 w-8 items-center justify-center rounded-[4px] bg-blue-500 text-white hover:bg-blue-600 disabled:opacity-50"
            aria-label="Send besked"
          >
            <Send className="h-3.5 w-3.5" aria-hidden />
          </button>
        </div>
      </div>
    </div>
  )
}

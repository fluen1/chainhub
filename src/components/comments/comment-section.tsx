'use client'

import { useState } from 'react'
import { MessageSquare, Trash2, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { createComment, deleteComment } from '@/actions/comments'
import { useRouter } from 'next/navigation'

interface CommentData {
  id: string
  content: string
  authorName: string
  authorId: string
  createdAt: string
}

interface CommentSectionProps {
  taskId: string
  comments: CommentData[]
  currentUserId: string
}

function formatRelativeDate(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'Lige nu'
  if (mins < 60) return `${mins} min. siden`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours} time${hours === 1 ? '' : 'r'} siden`
  const days = Math.floor(hours / 24)
  if (days < 7) return `${days} dag${days === 1 ? '' : 'e'} siden`
  return new Date(iso).toLocaleDateString('da-DK', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

export function CommentSection({ taskId, comments, currentUserId }: CommentSectionProps) {
  const [content, setContent] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const router = useRouter()

  const handleSubmit = async () => {
    if (!content.trim()) return
    setIsSubmitting(true)
    const result = await createComment({ content: content.trim(), taskId })
    if (result.error) {
      toast.error(result.error)
    } else {
      setContent('')
      router.refresh()
    }
    setIsSubmitting(false)
  }

  const handleDelete = async (commentId: string) => {
    setDeletingId(commentId)
    const result = await deleteComment(commentId)
    if (result.error) {
      toast.error(result.error)
    } else {
      router.refresh()
    }
    setDeletingId(null)
  }

  return (
    <div>
      <div className="mb-4 flex items-center gap-2">
        <MessageSquare className="h-4 w-4 text-gray-400" />
        <h2 className="text-sm font-semibold text-gray-900">Kommentarer ({comments.length})</h2>
      </div>

      {/* New comment form */}
      <div className="mb-4 rounded-xl border border-gray-200 bg-white p-4">
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="Skriv en kommentar..."
          rows={3}
          className="w-full resize-none rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
        />
        <div className="mt-2 flex justify-end">
          <button
            type="button"
            onClick={handleSubmit}
            disabled={isSubmitting || !content.trim()}
            className="inline-flex items-center gap-2 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            {isSubmitting ? 'Sender...' : 'Kommentér'}
          </button>
        </div>
      </div>

      {/* Comment list */}
      {comments.length === 0 ? (
        <p className="py-6 text-center text-sm text-gray-500">Ingen kommentarer endnu</p>
      ) : (
        <div className="space-y-3">
          {comments.map((c) => {
            const isOwn = c.authorId === currentUserId
            const initials = c.authorName
              .split(' ')
              .map((n) => n[0])
              .join('')
              .toUpperCase()
              .slice(0, 2)

            return (
              <div key={c.id} className="rounded-xl border border-gray-200 bg-white p-4">
                <div className="flex items-start gap-3">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gray-100 text-xs font-semibold text-gray-600">
                    {initials}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-gray-900">{c.authorName}</span>
                        <span className="text-xs text-gray-500">
                          {formatRelativeDate(c.createdAt)}
                        </span>
                      </div>
                      {isOwn && (
                        <button
                          type="button"
                          onClick={() => handleDelete(c.id)}
                          disabled={deletingId === c.id}
                          className="p-1 text-gray-300 transition-colors hover:text-red-500"
                          aria-label="Slet kommentar"
                        >
                          {deletingId === c.id ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <Trash2 className="h-3.5 w-3.5" />
                          )}
                        </button>
                      )}
                    </div>
                    <p className="mt-1 whitespace-pre-wrap text-sm text-gray-700">{c.content}</p>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

'use client'

import { useState, useTransition } from 'react'
import { Pin, Trash2, Search } from 'lucide-react'
import { toast } from 'sonner'
import { createCompanyNote, toggleNotePin, deleteCompanyNote } from '@/actions/company-notes'
import type { CompanyNoteWithAuthor } from '@/actions/company-notes'
import { Panel, PanelHeader } from '@/components/ui/b'

function formatRelativeTime(date: Date): string {
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMin = Math.floor(diffMs / 60000)
  if (diffMin < 1) return 'lige nu'
  if (diffMin < 60) return `${diffMin} min siden`
  const diffHours = Math.floor(diffMin / 60)
  if (diffHours < 24) return `${diffHours}t siden`
  const diffDays = Math.floor(diffHours / 24)
  if (diffDays < 30) return `${diffDays}d siden`
  return date.toLocaleDateString('da-DK', { day: 'numeric', month: 'short', year: 'numeric' })
}

interface NotesSectionProps {
  companyId: string
  notes: CompanyNoteWithAuthor[]
  readOnly?: boolean
}

export function NotesSection({ companyId, notes: initialNotes, readOnly }: NotesSectionProps) {
  const [content, setContent] = useState('')
  const [search, setSearch] = useState('')
  const [isPending, startTransition] = useTransition()

  const filteredNotes = initialNotes.filter(
    (n) => search === '' || n.content.toLowerCase().includes(search.toLowerCase())
  )

  function handleCreate() {
    if (!content.trim()) return
    startTransition(async () => {
      const result = await createCompanyNote({ companyId, content })
      if ('error' in result && result.error) {
        toast.error(result.error)
      } else {
        setContent('')
        toast.success('Notat tilføjet')
      }
    })
  }

  function handlePin(noteId: string) {
    startTransition(async () => {
      const result = await toggleNotePin(noteId)
      if ('error' in result && result.error) toast.error(result.error)
    })
  }

  function handleDelete(noteId: string) {
    startTransition(async () => {
      const result = await deleteCompanyNote(noteId)
      if ('error' in result && result.error) toast.error(result.error)
      else toast.success('Notat slettet')
    })
  }

  return (
    <Panel>
      <PanelHeader title="Noter" meta={`${initialNotes.length}`} />
      <div className="flex flex-col gap-2.5 px-3 py-3">
        {!readOnly && (
          <div className="flex flex-col gap-2">
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Skriv et notat..."
              className="w-full rounded-[4px] border border-b-border bg-white px-2.5 py-2 text-[13px] text-b-1 min-h-[72px] resize-y placeholder:text-b-3 focus:border-b-blue-fg focus:outline-none focus:ring-[3px] focus:ring-[#0969da1a]"
              maxLength={5000}
            />
            <button
              onClick={handleCreate}
              disabled={isPending || !content.trim()}
              className="self-start inline-flex items-center rounded-[4px] bg-b-accent px-3 py-1.5 text-[12px] font-medium text-white hover:bg-b-accent/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              Tilføj notat
            </button>
          </div>
        )}

        {initialNotes.length > 3 && (
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-b-3" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Søg i noter..."
              className="w-full rounded-[4px] border border-b-border bg-white pl-8 pr-2.5 py-1.5 text-[12px] text-b-1 placeholder:text-b-3 focus:border-b-blue-fg focus:outline-none focus:ring-[3px] focus:ring-[#0969da1a]"
            />
          </div>
        )}

        {filteredNotes.length === 0 && initialNotes.length === 0 && readOnly && (
          <p className="text-[12px] text-b-3 py-2">Ingen noter endnu</p>
        )}

        {filteredNotes.length > 0 && (
          <div className="flex flex-col gap-1.5">
            {filteredNotes.map((note) => (
              <div
                key={note.id}
                className={`rounded-[4px] border p-2.5 text-[13px] ${
                  note.pinned ? 'bg-amber-50 border-amber-200' : 'bg-white border-b-border'
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <p className="whitespace-pre-wrap flex-1 text-b-1 leading-relaxed">
                    {note.content}
                  </p>
                  {!readOnly && (
                    <div className="flex shrink-0 gap-0.5">
                      <button
                        onClick={() => handlePin(note.id)}
                        className={`rounded p-1 hover:bg-zinc-100 ${
                          note.pinned ? 'text-amber-600' : 'text-b-3'
                        }`}
                        title={note.pinned ? 'Frigør' : 'Fastgør'}
                      >
                        <Pin className="h-3.5 w-3.5" />
                      </button>
                      <button
                        onClick={() => handleDelete(note.id)}
                        className="rounded p-1 text-b-3 hover:bg-red-50 hover:text-red-600"
                        title="Slet"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  )}
                </div>
                <p className="mt-1.5 text-[11px] text-b-3">
                  {note.author.name ?? note.author.email} ·{' '}
                  {formatRelativeTime(new Date(note.created_at))}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>
    </Panel>
  )
}

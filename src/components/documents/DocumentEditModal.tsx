'use client'

import { useState } from 'react'
import { X } from 'lucide-react'
import { toast } from 'sonner'
import { updateDocument } from '@/actions/documents'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import type { DocumentWithRelations } from '@/types/document'

interface DocumentEditModalProps {
  document: DocumentWithRelations
  onClose: () => void
  onComplete: (updated: DocumentWithRelations) => void
}

const SENSITIVITY_OPTIONS = [
  { value: 'PUBLIC', label: 'Offentlig' },
  { value: 'STANDARD', label: 'Standard' },
  { value: 'INTERN', label: 'Intern' },
  { value: 'FORTROLIG', label: 'Fortrolig' },
  { value: 'STRENGT_FORTROLIG', label: 'Strengt fortrolig' },
]

export function DocumentEditModal({
  document,
  onClose,
  onComplete,
}: DocumentEditModalProps) {
  const [title, setTitle] = useState(document.title)
  const [description, setDescription] = useState(document.description ?? '')
  const [folderPath, setFolderPath] = useState(document.folderPath ?? '')
  const [sensitivity, setSensitivity] = useState(document.sensitivity)
  const [isSaving, setIsSaving] = useState(false)

  const handleSave = async () => {
    if (!title.trim()) {
      toast.error('Titel er påkrævet')
      return
    }

    setIsSaving(true)
    try {
      const result = await updateDocument({
        documentId: document.id,
        title: title.trim(),
        description: description || null,
        folderPath: folderPath || null,
        sensitivity: sensitivity as 'PUBLIC' | 'STANDARD' | 'INTERN' | 'FORTROLIG' | 'STRENGT_FORTROLIG',
      })

      if (result.error) {
        toast.error(result.error)
        return
      }

      // Sammensæt opdateret dokument
      const updated: DocumentWithRelations = {
        ...document,
        title: result.data.title,
        description: result.data.description,
        folderPath: result.data.folderPath,
        sensitivity: result.data.sensitivity,
      }

      onComplete(updated)
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-md rounded-xl bg-white shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4">
          <h2 className="text-lg font-semibold text-gray-900">Rediger dokument</h2>
          <button
            onClick={onClose}
            disabled={isSaving}
            className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Indhold */}
        <div className="space-y-4 px-6 py-4">
          <div className="space-y-1">
            <Label htmlFor="edit-title">Titel *</Label>
            <Input
              id="edit-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              disabled={isSaving}
            />
          </div>

          <div className="space-y-1">
            <Label>Sensitivitet</Label>
            <Select
              value={sensitivity}
              onValueChange={(v) => setSensitivity(v as typeof sensitivity)}
              disabled={isSaving}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {SENSITIVITY_OPTIONS.map((o) => (
                  <SelectItem key={o.value} value={o.value}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1">
            <Label htmlFor="edit-folder">Mappesti</Label>
            <Input
              id="edit-folder"
              value={folderPath}
              onChange={(e) => setFolderPath(e.target.value)}
              placeholder="fx kontrakter/2024"
              disabled={isSaving}
            />
          </div>

          <div className="space-y-1">
            <Label htmlFor="edit-description">Beskrivelse</Label>
            <Textarea
              id="edit-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              disabled={isSaving}
            />
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-3 border-t border-gray-100 px-6 py-4">
          <Button variant="outline" onClick={onClose} disabled={isSaving}>
            Annuller
          </Button>
          <Button onClick={handleSave} disabled={isSaving}>
            {isSaving ? 'Gemmer...' : 'Gem ændringer'}
          </Button>
        </div>
      </div>
    </div>
  )
}
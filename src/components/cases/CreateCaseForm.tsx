'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { toast } from 'sonner'

export function CreateCaseForm() {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [title, setTitle] = useState('')

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!title.trim()) {
      toast.error('Angiv en titel for sagen')
      return
    }
    toast.info('Sagsoprettelse er under udvikling.')
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="title">Sagstitel</Label>
        <Input
          id="title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Indtast sagstitel..."
          disabled={isPending}
        />
      </div>
      <div className="flex gap-2">
        <Button type="submit" disabled={isPending}>
          Opret sag
        </Button>
        <Button type="button" variant="outline" onClick={() => router.back()}>
          Annuller
        </Button>
      </div>
    </form>
  )
}

'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Calendar, ExternalLink } from 'lucide-react'
import { toast } from 'sonner'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'

interface OutlookCalendarButtonProps {
  taskId: string
  taskTitle: string
  hasDueDate: boolean
}

export function OutlookCalendarButton({
  taskId,
  taskTitle,
  hasDueDate,
}: OutlookCalendarButtonProps) {
  const [loading, setLoading] = useState(false)

  const handlePush = async () => {
    if (!hasDueDate) {
      toast.error('Opgaven skal have en forfaldsdato for at tilføje til kalender')
      return
    }

    setLoading(true)
    try {
      const response = await fetch('/api/tasks/outlook-calendar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ taskId }),
      })

      const data = await response.json()

      if (!response.ok) {
        if (response.status === 501) {
          toast.error('Outlook Calendar-integration er ikke konfigureret for denne installation')
        } else if (response.status === 403) {
          toast.error('Din konto er ikke forbundet med Microsoft — log ind via Microsoft for at bruge denne funktion')
        } else {
          toast.error(data.error ?? 'Noget gik galt — prøv igen')
        }
      } else if (data.placeholder) {
        toast.info('Outlook Calendar-integration er under udvikling — kommer snart')
      } else {
        toast.success(`${taskTitle} er tilføjet til din Outlook-kalender`)
      }
    } catch {
      toast.error('Kunne ikke kontakte Calendar-tjenesten — prøv igen')
    } finally {
      setLoading(false)
    }
  }

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            onClick={handlePush}
            disabled={loading || !hasDueDate}
            className="gap-2"
          >
            <Calendar className="h-4 w-4" />
            <span>Tilføj til Outlook</span>
            <ExternalLink className="h-3.5 w-3.5 text-gray-400" />
          </Button>
        </TooltipTrigger>
        <TooltipContent>
          {hasDueDate
            ? 'Tilføj opgaven til din Outlook-kalender'
            : 'Opgaven skal have en forfaldsdato'}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}
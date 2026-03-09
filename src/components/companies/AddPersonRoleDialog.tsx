'use client'

import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'

interface AddPersonRoleDialogProps {
  companyId: string
  allowedRoles: string[]
  title: string
  showEmploymentType?: boolean
  onClose: () => void
}

export function AddPersonRoleDialog({
  companyId,
  allowedRoles,
  title,
  showEmploymentType,
  onClose,
}: AddPersonRoleDialogProps) {
  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">Denne funktion er under udvikling.</p>
        <div className="flex justify-end">
          <Button variant="outline" onClick={onClose}>Luk</Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

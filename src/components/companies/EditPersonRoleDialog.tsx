'use client'

import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'

interface EditPersonRoleDialogProps {
  companyPerson: unknown
  companyId: string
  allowedRoles: string[]
  showEmploymentType?: boolean
  onClose: () => void
}

export function EditPersonRoleDialog({
  companyPerson,
  companyId,
  allowedRoles,
  showEmploymentType,
  onClose,
}: EditPersonRoleDialogProps) {
  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Rediger rolle</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">Denne funktion er under udvikling.</p>
        <div className="flex justify-end">
          <Button variant="outline" onClick={onClose}>Luk</Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

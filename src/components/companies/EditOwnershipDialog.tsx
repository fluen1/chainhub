'use client'

import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'

interface EditOwnershipDialogProps {
  ownership: unknown
  companyId: string
  onClose: () => void
}

export function EditOwnershipDialog({
  ownership,
  companyId,
  onClose,
}: EditOwnershipDialogProps) {
  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Rediger ejerskab</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">Denne funktion er under udvikling.</p>
        <div className="flex justify-end">
          <Button variant="outline" onClick={onClose}>Luk</Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

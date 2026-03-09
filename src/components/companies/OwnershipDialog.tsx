'use client'

import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useState, useEffect } from 'react'
import { toast } from 'sonner'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { createOwnershipSchema, updateOwnershipSchema, type CreateOwnershipInput } from '@/lib/validations/company'
import { createOwnership, updateOwnership } from '@/actions/companies'
import { Loader2 } from 'lucide-react'

interface OwnershipData {
  id: string
  ownerPersonId: string | null
  ownerCompanyId: string | null
  ownershipPct: number | string
  shareClass: string | null
  effectiveDate: string | null
  contractId: string | null
}

interface OwnershipDialogProps {
  companyId: string
  ownership?: OwnershipData | null
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function OwnershipDialog({
  companyId,
  ownership,
  open,
  onOpenChange,
}: OwnershipDialogProps) {
  const [isSubmitting, setIsSubmitting] = useState(false)
  const isEditing = !!ownership

  const form = useForm<CreateOwnershipInput>({
    resolver: zodResolver(isEditing ? updateOwnershipSchema : createOwnershipSchema),
    defaultValues: {
      companyId,
      ownerType: 'person',
      ownerPersonId: '',
      ownerCompanyId: '',
      ownershipPct: 0,
      shareClass: '',
      effectiveDate: undefined,
      contractId: '',
    },
  })

  useEffect(() => {
    if (ownership) {
      form.reset({
        companyId,
        ownerType: ownership.ownerPersonId ? 'person' : 'company',
        ownerPersonId: ownership.ownerPersonId || '',
        ownerCompanyId: ownership.ownerCompanyId || '',
        ownershipPct: Number(ownership.ownershipPct),
        shareClass: ownership.shareClass || '',
        effectiveDate: ownership.effectiveDate || undefined,
        contractId: ownership.contractId || '',
      })
    } else {
      form.reset({
        companyId,
        ownerType: 'person',
        ownerPersonId: '',
        ownerCompanyId: '',
        ownershipPct: 0,
        shareClass: '',
        effectiveDate: undefined,
        contractId: '',
      })
    }
  }, [ownership, companyId, form])

  async function onSubmit(data: CreateOwnershipInput) {
    setIsSubmitting(true)
    try {
      if (isEditing && ownership) {
        const result = await updateOwnership({
          id: ownership.id,
          ownershipPct: data.ownershipPct,
          shareClass: data.shareClass,
          effectiveDate: data.effectiveDate,
          contractId: data.contractId,
        })
        if (result.error) {
          toast.error(result.error)
          return
        }
        toast.success('Ejerskab opdateret')
      } else {
        const result = await createOwnership(data)
        if (result.error) {
          toast.error(result.error)
          return
        }
        toast.success('Ejerskab oprettet')
      }
      onOpenChange(false)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{isEditing ? 'Rediger ejerskab' : 'Tilføj ejer'}</DialogTitle>
        </DialogHeader>

        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          {!isEditing && (
            <div className="space-y-1">
              <Label>Ejertype</Label>
              <Select
                value={form.watch('ownerType')}
                onValueChange={(v) => form.setValue('ownerType', v as 'person' | 'company')}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Vælg type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="person">Person</SelectItem>
                  <SelectItem value="company">Selskab</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="space-y-1">
            <Label htmlFor="ownershipPct">Ejerandel (%)</Label>
            <Input
              id="ownershipPct"
              type="number"
              step="0.01"
              min="0.01"
              max="100"
              {...form.register('ownershipPct', { valueAsNumber: true })}
            />
            {form.formState.errors.ownershipPct && (
              <p className="text-xs text-red-600">{form.formState.errors.ownershipPct.message}</p>
            )}
          </div>

          <div className="space-y-1">
            <Label htmlFor="shareClass">Aktieklasse</Label>
            <Input
              id="shareClass"
              {...form.register('shareClass')}
              placeholder="fx A-aktier"
            />
          </div>

          <div className="space-y-1">
            <Label htmlFor="effectiveDate">Ikrafttrædelsesdato</Label>
            <Input
              id="effectiveDate"
              type="date"
              {...form.register('effectiveDate')}
            />
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Annuller
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {isEditing ? 'Gem ændringer' : 'Tilføj ejer'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
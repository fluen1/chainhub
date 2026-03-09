'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { ContractSystemType, SensitivityLevel, DeadlineType, VersionSource } from '@prisma/client'
import { createContract, updateContract } from '@/actions/contracts'
import type { CreateContractInput, UpdateContractInput } from '@/lib/validations/contract'
import { toast } from 'sonner'
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
import { Loader2 } from 'lucide-react'

interface Company {
  id: string
  name: string
}

interface ContractFormProps {
  companies: Company[]
  initialData?: Partial<CreateContractInput & { id: string }>
  isEdit?: boolean
}

const MVP_CONTRACT_TYPES: ContractSystemType[] = [
  'EJERAFTALE',
  'DIREKTOERKONTRAKT',
  'ANSAETTELSE_FUNKTIONAER',
  'LEJEKONTRAKT_ERHVERV',
  'LEVERANDOERKONTRAKT',
  'INTERN_SERVICEAFTALE',
  'VEDTAEGTER',
  'FORSIKRING',
]

const CONTRACT_TYPE_LABELS: Record<string, string> = {
  EJERAFTALE: 'Ejeraftale',
  DIREKTOERKONTRAKT: 'Direktørkontrakt',
  ANSAETTELSE_FUNKTIONAER: 'Ansættelse (funktionær)',
  LEJEKONTRAKT_ERHVERV: 'Lejekontrakt (erhverv)',
  LEVERANDOERKONTRAKT: 'Leverandørkontrakt',
  INTERN_SERVICEAFTALE: 'Intern serviceaftale',
  VEDTAEGTER: 'Vedtægter',
  FORSIKRING: 'Forsikring',
}

const SENSITIVITY_OPTIONS: { value: SensitivityLevel; label: string }[] = [
  { value: 'PUBLIC', label: 'Offentlig' },
  { value: 'STANDARD', label: 'Standard' },
  { value: 'INTERN', label: 'Intern' },
  { value: 'FORTROLIG', label: 'Fortrolig' },
  { value: 'STRENGT_FORTROLIG', label: 'Strengt fortrolig' },
]

const DEADLINE_OPTIONS: { value: DeadlineType; label: string }[] = [
  { value: 'INGEN', label: 'Ingen' },
  { value: 'OPERATIONEL', label: 'Operationel' },
  { value: 'ABSOLUT', label: 'Absolut (juridisk bindende)' },
]

const VERSION_SOURCE_OPTIONS: { value: VersionSource; label: string }[] = [
  { value: 'CUSTOM', label: 'Eget dokument' },
  { value: 'INTERNT', label: 'Intern skabelon' },
  { value: 'EKSTERNT_STANDARD', label: 'Ekstern standard' },
  { value: 'BRANCHESTANDARD', label: 'Branchestandard/overenskomst' },
]

export function ContractForm({ companies, initialData, isEdit = false }: ContractFormProps) {
  const router = useRouter()
  const [isSubmitting, setIsSubmitting] = useState(false)

  const [formData, setFormData] = useState({
    companyId: initialData?.companyId || '',
    systemType: initialData?.systemType || ('' as ContractSystemType | ''),
    displayName: initialData?.displayName || '',
    sensitivity: initialData?.sensitivity || ('STANDARD' as SensitivityLevel),
    deadlineType: initialData?.deadlineType || ('INGEN' as DeadlineType),
    versionSource: initialData?.versionSource || ('CUSTOM' as VersionSource),
    startDate: initialData?.startDate || '',
    endDate: initialData?.endDate || '',
    noticePeriodDays: initialData?.noticePeriodDays?.toString() || '',
    autoRenewal: initialData?.autoRenewal || false,
    notes: initialData?.notes || '',
    counterpartyName: initialData?.counterpartyName || '',
  })

  const handleChange = (field: string, value: string | boolean) => {
    setFormData((prev) => ({ ...prev, [field]: value }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)

    if (!formData.companyId) {
      toast.error('Vælg venligst et selskab')
      setIsSubmitting(false)
      return
    }

    if (!formData.systemType) {
      toast.error('Vælg venligst en kontrakttype')
      setIsSubmitting(false)
      return
    }

    try {
      const payload: CreateContractInput = {
        companyId: formData.companyId,
        systemType: formData.systemType as ContractSystemType,
        displayName: formData.displayName || undefined,
        sensitivity: formData.sensitivity,
        deadlineType: formData.deadlineType,
        versionSource: formData.versionSource,
        startDate: formData.startDate || undefined,
        endDate: formData.endDate || undefined,
        noticePeriodDays: formData.noticePeriodDays ? parseInt(formData.noticePeriodDays, 10) : undefined,
        autoRenewal: formData.autoRenewal,
        notes: formData.notes || undefined,
        counterpartyName: formData.counterpartyName || undefined,
      }

      if (isEdit && initialData?.id) {
        const updatePayload: UpdateContractInput = {
          id: initialData.id,
          displayName: payload.displayName,
          sensitivity: payload.sensitivity,
          deadlineType: payload.deadlineType,
          versionSource: payload.versionSource,
          startDate: payload.startDate,
          endDate: payload.endDate,
          noticePeriodDays: payload.noticePeriodDays,
          autoRenewal: payload.autoRenewal,
          notes: payload.notes,
          counterpartyName: payload.counterpartyName,
        }
        const result = await updateContract(updatePayload)
        if (result.error) {
          toast.error(result.error)
          return
        }
        toast.success('Kontrakt opdateret')
        router.push(`/contracts/${initialData.id}`)
      } else {
        const result = await createContract(payload)
        if (result.error) {
          toast.error(result.error)
          return
        }
        toast.success('Kontrakt oprettet')
        if (result.data) {
          router.push(`/contracts/${result.data.id}`)
        }
      }
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="space-y-1">
          <Label htmlFor="companyId">Selskab *</Label>
          <Select
            value={formData.companyId}
            onValueChange={(v) => handleChange('companyId', v)}
          >
            <SelectTrigger>
              <SelectValue placeholder="Vælg selskab" />
            </SelectTrigger>
            <SelectContent>
              {companies.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1">
          <Label htmlFor="systemType">Kontrakttype *</Label>
          <Select
            value={formData.systemType}
            onValueChange={(v) => handleChange('systemType', v)}
            disabled={isEdit}
          >
            <SelectTrigger>
              <SelectValue placeholder="Vælg type" />
            </SelectTrigger>
            <SelectContent>
              {MVP_CONTRACT_TYPES.map((t) => (
                <SelectItem key={t} value={t}>
                  {CONTRACT_TYPE_LABELS[t] ?? t}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1 sm:col-span-2">
          <Label htmlFor="displayName">Visningsnavn</Label>
          <Input
            id="displayName"
            value={formData.displayName}
            onChange={(e) => handleChange('displayName', e.target.value)}
            placeholder="Valgfrit navn til kontrakten"
          />
        </div>

        <div className="space-y-1">
          <Label htmlFor="sensitivity">Fortrolighedsniveau</Label>
          <Select
            value={formData.sensitivity}
            onValueChange={(v) => handleChange('sensitivity', v)}
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
          <Label htmlFor="deadlineType">Deadlinetype</Label>
          <Select
            value={formData.deadlineType}
            onValueChange={(v) => handleChange('deadlineType', v)}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {DEADLINE_OPTIONS.map((o) => (
                <SelectItem key={o.value} value={o.value}>
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1">
          <Label htmlFor="versionSource">Dokumentkilde</Label>
          <Select
            value={formData.versionSource}
            onValueChange={(v) => handleChange('versionSource', v)}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {VERSION_SOURCE_OPTIONS.map((o) => (
                <SelectItem key={o.value} value={o.value}>
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1">
          <Label htmlFor="counterpartyName">Modpart</Label>
          <Input
            id="counterpartyName"
            value={formData.counterpartyName}
            onChange={(e) => handleChange('counterpartyName', e.target.value)}
            placeholder="Navn på modpart"
          />
        </div>

        <div className="space-y-1">
          <Label htmlFor="startDate">Startdato</Label>
          <Input
            id="startDate"
            type="date"
            value={formData.startDate}
            onChange={(e) => handleChange('startDate', e.target.value)}
          />
        </div>

        <div className="space-y-1">
          <Label htmlFor="endDate">Slutdato</Label>
          <Input
            id="endDate"
            type="date"
            value={formData.endDate}
            onChange={(e) => handleChange('endDate', e.target.value)}
          />
        </div>

        <div className="space-y-1">
          <Label htmlFor="noticePeriodDays">Opsigelsesvarsel (dage)</Label>
          <Input
            id="noticePeriodDays"
            type="number"
            min="0"
            value={formData.noticePeriodDays}
            onChange={(e) => handleChange('noticePeriodDays', e.target.value)}
            placeholder="fx 30"
          />
        </div>

        <div className="space-y-1 sm:col-span-2">
          <Label htmlFor="notes">Noter</Label>
          <Textarea
            id="notes"
            value={formData.notes}
            onChange={(e) => handleChange('notes', e.target.value)}
            rows={3}
            placeholder="Interne noter om kontrakten"
          />
        </div>
      </div>

      <div className="flex justify-end gap-3">
        <Button type="button" variant="outline" onClick={() => router.back()}>
          Annuller
        </Button>
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {isEdit ? 'Gem ændringer' : 'Opret kontrakt'}
        </Button>
      </div>
    </form>
  )
}
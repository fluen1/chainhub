'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { ContractSystemType, SensitivityLevel, DeadlineType, VersionSource } from '@prisma/client'
import { createContract, updateContract } from '@/actions/contracts'
import { CreateContractInput, UpdateContractInput, getMinSensitivity, meetsMinimumSensitivity } from '@/lib/validations/contract'
import { getContractTypeLabel } from './ContractTypeBadge'
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
import { Calendar } from '@/components/ui/calendar'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { format } from 'date-fns'
import { da } from 'date-fns/locale'
import { CalendarIcon, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'

interface Company {
  id: string
  name: string
}

interface ContractFormProps {
  companies: Company[]
  initialData?: Partial<CreateContractInput & { id: string }>
  isEdit?: boolean
}

// MVP kontrakttyper (fra CONTRACT-TYPES.md DEC-006)
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
    systemType: initialData?.systemType || ('' as ContractSystemType),
    displayName: initialData?.displayName || '',
    sensitivity: initialData?.sensitivity || ('STANDARD' as SensitivityLevel),
    deadlineType: initialData?.deadlineType || ('INGEN' as DeadlineType),
    versionSource: initialData?.versionSource || ('CUSTOM' as VersionSource),
    startDate: initialData?.startDate ? new Date(initialData.startDate) : null as Date | null,
    endDate: initialData?.endDate ? new Date(initialData.endDate) : null as Date | null,
    noticePeriodDays: initialData?.noticePeriodDays?.toString() || '',
    autoRenews: initialData?.autoRenews ?? false,
    counterpartyName: initialData?.counterpartyName || '',
    counterpartyOrg: initialData?.counterpartyOrg || '',
    notes: initialData?.notes || '',
  })

  const handleSystemTypeChange = (value: ContractSystemType) => {
    const minSensitivity = getMinSensitivity(value)
    setFormData(prev => {
      const currentSensitivityIndex = SENSITIVITY_OPTIONS.findIndex(o => o.value === prev.sensitivity)
      const minSensitivityIndex = SENSITIVITY_OPTIONS.findIndex(o => o.value === minSensitivity)
      return {
        ...prev,
        systemType: value,
        sensitivity: currentSensitivityIndex < minSensitivityIndex ? minSensitivity : prev.sensitivity,
      }
    })
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!formData.companyId) {
      toast.error('Vælg et selskab')
      return
    }
    
    if (!formData.systemType) {
      toast.error('Vælg en kontrakttype')
      return
    }

    if (formData.systemType && !meetsMinimumSensitivity(formData.systemType, formData.sensitivity)) {
      toast.error('Sensitivitetsniveau er for lavt for denne kontrakttype')
      return
    }

    setIsSubmitting(true)

    try {
      if (isEdit && initialData?.id) {
        const updateData: UpdateContractInput = {
          id: initialData.id,
          displayName: formData.displayName || undefined,
          sensitivity: formData.sensitivity,
          deadlineType: formData.deadlineType,
          startDate: formData.startDate?.toISOString() || undefined,
          endDate: formData.endDate?.toISOString() || undefined,
          noticePeriodDays: formData.noticePeriodDays ? parseInt(formData.noticePeriodDays) : undefined,
          autoRenews: formData.autoRenews,
          counterpartyName: formData.counterpartyName || undefined,
          counterpartyOrg: formData.counterpartyOrg || undefined,
          notes: formData.notes || undefined,
        }
        
        const result = await updateContract(updateData)
        
        if (result.error) {
          toast.error(result.error)
          return
        }
        
        toast.success('Kontrakt opdateret')
        router.push(`/contracts/${initialData.id}`)
      } else {
        const createData: CreateContractInput = {
          companyId: formData.companyId,
          systemType: formData.systemType,
          displayName: formData.displayName || undefined,
          sensitivity: formData.sensitivity,
          deadlineType: formData.deadlineType,
          versionSource: formData.versionSource,
          startDate: formData.startDate?.toISOString() || undefined,
          endDate: formData.endDate?.toISOString() || undefined,
          noticePeriodDays: formData.noticePeriodDays ? parseInt(formData.noticePeriodDays) : undefined,
          autoRenews: formData.autoRenews,
          counterpartyName: formData.counterpartyName || undefined,
          counterpartyOrg: formData.counterpartyOrg || undefined,
          notes: formData.notes || undefined,
        }
        
        const result = await createContract(createData)
        
        if (result.error) {
          toast.error(result.error)
          return
        }
        
        toast.success('Kontrakt oprettet')
        router.push(`/contracts/${result.data!.id}`)
      }
    } finally {
      setIsSubmitting(false)
    }
  }

  const minSensitivity = formData.systemType ? getMinSensitivity(formData.systemType) : null
  const minSensitivityIndex = minSensitivity
    ? SENSITIVITY_OPTIONS.findIndex(o => o.value === minSensitivity)
    : -1

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Selskab */}
      {!isEdit && (
        <div className="space-y-2">
          <Label htmlFor="companyId">Selskab *</Label>
          <Select
            value={formData.companyId}
            onValueChange={(val) => setFormData(prev => ({ ...prev, companyId: val }))}
          >
            <SelectTrigger>
              <SelectValue placeholder="Vælg selskab" />
            </SelectTrigger>
            <SelectContent>
              {companies.map((company) => (
                <SelectItem key={company.id} value={company.id}>
                  {company.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {/* Kontrakttype */}
      {!isEdit && (
        <div className="space-y-2">
          <Label htmlFor="systemType">Kontrakttype *</Label>
          <Select
            value={formData.systemType}
            onValueChange={(val) => handleSystemTypeChange(val as ContractSystemType)}
          >
            <SelectTrigger>
              <SelectValue placeholder="Vælg kontrakttype" />
            </SelectTrigger>
            <SelectContent>
              {MVP_CONTRACT_TYPES.map((type) => (
                <SelectItem key={type} value={type}>
                  {getContractTypeLabel(type)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {/* Visningsnavn */}
      <div className="space-y-2">
        <Label htmlFor="displayName">Navn / beskrivelse</Label>
        <Input
          id="displayName"
          value={formData.displayName}
          onChange={(e) => setFormData(prev => ({ ...prev, displayName: e.target.value }))}
          placeholder="Fx 'Lejekontrakt Aarhus kontor'"
        />
      </div>

      {/* Sensitivitet */}
      <div className="space-y-2">
        <Label>Sensitivitetsniveau *</Label>
        <Select
          value={formData.sensitivity}
          onValueChange={(val) => setFormData(prev => ({ ...prev, sensitivity: val as SensitivityLevel }))}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {SENSITIVITY_OPTIONS.map((opt, index) => (
              <SelectItem
                key={opt.value}
                value={opt.value}
                disabled={index < minSensitivityIndex}
              >
                {opt.label}
                {index < minSensitivityIndex && ' (for lavt)'}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {minSensitivity && (
          <p className="text-xs text-gray-500">
            Minimum for denne kontrakttype: {SENSITIVITY_OPTIONS.find(o => o.value === minSensitivity)?.label}
          </p>
        )}
      </div>

      {/* Deadline-type */}
      <div className="space-y-2">
        <Label>Deadline-type</Label>
        <Select
          value={formData.deadlineType}
          onValueChange={(val) => setFormData(prev => ({ ...prev, deadlineType: val as DeadlineType }))}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {DEADLINE_OPTIONS.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Versionstype */}
      {!isEdit && (
        <div className="space-y-2">
          <Label>Dokumenttype</Label>
          <Select
            value={formData.versionSource}
            onValueChange={(val) => setFormData(prev => ({ ...prev, versionSource: val as VersionSource }))}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {VERSION_SOURCE_OPTIONS.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {/* Datoer */}
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Startdato</Label>
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                className={cn(
                  'w-full justify-start text-left font-normal',
                  !formData.startDate && 'text-muted-foreground'
                )}
              >
                <CalendarIcon className="mr-2 h-4 w-4" />
                {formData.startDate
                  ? format(formData.startDate, 'PPP', { locale: da })
                  : 'Vælg dato'}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0">
              <Calendar
                mode="single"
                selected={formData.startDate ?? undefined}
                onSelect={(date) => setFormData(prev => ({ ...prev, startDate: date ?? null }))}
                initialFocus
              />
            </PopoverContent>
          </Popover>
        </div>

        <div className="space-y-2">
          <Label>Slutdato</Label>
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                className={cn(
                  'w-full justify-start text-left font-normal',
                  !formData.endDate && 'text-muted-foreground'
                )}
              >
                <CalendarIcon className="mr-2 h-4 w-4" />
                {formData.endDate
                  ? format(formData.endDate, 'PPP', { locale: da })
                  : 'Vælg dato'}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0">
              <Calendar
                mode="single"
                selected={formData.endDate ?? undefined}
                onSelect={(date) => setFormData(prev => ({ ...prev, endDate: date ?? null }))}
                initialFocus
              />
            </PopoverContent>
          </Popover>
        </div>
      </div>

      {/* Opsigelse */}
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="noticePeriodDays">Opsigelsesperiode (dage)</Label>
          <Input
            id="noticePeriodDays"
            type="number"
            min="0"
            value={formData.noticePeriodDays}
            onChange={(e) => setFormData(prev => ({ ...prev, noticePeriodDays: e.target.value }))}
            placeholder="Fx 30"
          />
        </div>

        <div className="space-y-2">
          <Label>Automatisk fornyelse</Label>
          <div className="flex items-center gap-2 pt-2">
            <input
              type="checkbox"
              id="autoRenews"
              checked={formData.autoRenews}
              onChange={(e) => setFormData(prev => ({ ...prev, autoRenews: e.target.checked }))}
              className="h-4 w-4 rounded border-gray-300"
            />
            <label htmlFor="autoRenews" className="text-sm text-gray-700">
              Kontrakten fornyes automatisk
            </label>
          </div>
        </div>
      </div>

      {/* Modpart */}
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="counterpartyName">Modpartsnavn</Label>
          <Input
            id="counterpartyName"
            value={formData.counterpartyName}
            onChange={(e) => setFormData(prev => ({ ...prev, counterpartyName: e.target.value }))}
            placeholder="Fx Hansen Ejendomme A/S"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="counterpartyOrg">Modparts CVR</Label>
          <Input
            id="counterpartyOrg"
            value={formData.counterpartyOrg}
            onChange={(e) => setFormData(prev => ({ ...prev, counterpartyOrg: e.target.value }))}
            placeholder="12345678"
          />
        </div>
      </div>

      {/* Noter */}
      <div className="space-y-2">
        <Label htmlFor="notes">Noter</Label>
        <Textarea
          id="notes"
          value={formData.notes}
          onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
          placeholder="Interne noter om kontrakten..."
          rows={3}
        />
      </div>

      {/* Knapper */}
      <div className="flex justify-end gap-3">
        <Button
          type="button"
          variant="outline"
          onClick={() => router.back()}
          disabled={isSubmitting}
        >
          Annuller
        </Button>
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
          {isEdit ? 'Gem ændringer' : 'Opret kontrakt'}
        </Button>
      </div>
    </form>
  )
}
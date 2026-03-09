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
    counterpartyName: initialData?.counterpartyName || '',
    counterpartyOrg: initialData?.counterpartyOrg || '',
    startDate: initialData?.startDate ? new Date(initialData.startDate) : undefined as Date | undefined,
    endDate: initialData?.endDate ? new Date(initialData.endDate) : undefined as Date | undefined,
    deadlineDate: initialData?.deadlineDate ? new Date(initialData.deadlineDate) : undefined as Date | undefined,
    noticeDays: initialData?.noticeDays || undefined as number | undefined,
    autoRenew: initialData?.autoRenew || false,
    description: initialData?.description || '',
    internalNotes: initialData?.internalNotes || '',
    tags: initialData?.tags || [] as string[],
  })

  const [tagInput, setTagInput] = useState('')

  const minSensitivity = formData.systemType ? getMinSensitivity(formData.systemType) : null

  const handleSystemTypeChange = (value: ContractSystemType) => {
    const newMin = getMinSensitivity(value)
    setFormData((prev) => {
      let sensitivity = prev.sensitivity
      if (newMin && !meetsMinimumSensitivity(prev.sensitivity, newMin)) {
        sensitivity = newMin
      }
      return { ...prev, systemType: value, sensitivity }
    })
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)

    try {
      if (isEdit && initialData?.id) {
        const updateData: UpdateContractInput = {
          id: initialData.id,
          displayName: formData.displayName || undefined,
          sensitivity: formData.sensitivity,
          deadlineType: formData.deadlineType,
          counterpartyName: formData.counterpartyName || undefined,
          counterpartyOrg: formData.counterpartyOrg || undefined,
          startDate: formData.startDate?.toISOString(),
          endDate: formData.endDate?.toISOString(),
          deadlineDate: formData.deadlineDate?.toISOString(),
          noticeDays: formData.noticeDays,
          autoRenew: formData.autoRenew,
          description: formData.description || undefined,
          internalNotes: formData.internalNotes || undefined,
          tags: formData.tags,
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
          counterpartyName: formData.counterpartyName || undefined,
          counterpartyOrg: formData.counterpartyOrg || undefined,
          startDate: formData.startDate?.toISOString(),
          endDate: formData.endDate?.toISOString(),
          deadlineDate: formData.deadlineDate?.toISOString(),
          noticeDays: formData.noticeDays,
          autoRenew: formData.autoRenew,
          description: formData.description || undefined,
          internalNotes: formData.internalNotes || undefined,
          tags: formData.tags,
        }

        const result = await createContract(createData)
        if (result.error) {
          toast.error(result.error)
          return
        }
        toast.success('Kontrakt oprettet')
        router.push('/contracts')
      }
    } finally {
      setIsSubmitting(false)
    }
  }

  const addTag = () => {
    const tag = tagInput.trim().toLowerCase()
    if (tag && !formData.tags.includes(tag)) {
      setFormData((prev) => ({ ...prev, tags: [...prev.tags, tag] }))
    }
    setTagInput('')
  }

  const removeTag = (tag: string) => {
    setFormData((prev) => ({
      ...prev,
      tags: prev.tags.filter((t) => t !== tag),
    }))
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Selskab */}
      {!isEdit && (
        <div className="space-y-2">
          <Label htmlFor="companyId">Selskab *</Label>
          <Select
            value={formData.companyId}
            onValueChange={(value) =>
              setFormData((prev) => ({ ...prev, companyId: value }))
            }
          >
            <SelectTrigger>
              <SelectValue placeholder="Vælg selskab..." />
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
            onValueChange={(value) =>
              handleSystemTypeChange(value as ContractSystemType)
            }
          >
            <SelectTrigger>
              <SelectValue placeholder="Vælg kontrakttype..." />
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
        <Label htmlFor="displayName">Visningsnavn (valgfri)</Label>
        <Input
          id="displayName"
          value={formData.displayName}
          onChange={(e) =>
            setFormData((prev) => ({ ...prev, displayName: e.target.value }))
          }
          placeholder="f.eks. Lejekontrakt Østerbrogade 2024"
        />
      </div>

      {/* Sensitivitet */}
      <div className="space-y-2">
        <Label>Sensitivitet *</Label>
        {minSensitivity && (
          <p className="text-xs text-amber-600">
            Minimum sensitivitet for denne kontrakttype: {minSensitivity}
          </p>
        )}
        <Select
          value={formData.sensitivity}
          onValueChange={(value) =>
            setFormData((prev) => ({
              ...prev,
              sensitivity: value as SensitivityLevel,
            }))
          }
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {SENSITIVITY_OPTIONS.map((opt) => (
              <SelectItem
                key={opt.value}
                value={opt.value}
                disabled={
                  minSensitivity
                    ? !meetsMinimumSensitivity(opt.value, minSensitivity)
                    : false
                }
              >
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Deadline type */}
      <div className="space-y-2">
        <Label>Deadline-type</Label>
        <Select
          value={formData.deadlineType}
          onValueChange={(value) =>
            setFormData((prev) => ({
              ...prev,
              deadlineType: value as DeadlineType,
            }))
          }
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

      {/* Version source */}
      {!isEdit && (
        <div className="space-y-2">
          <Label>Dokumentkilde</Label>
          <Select
            value={formData.versionSource}
            onValueChange={(value) =>
              setFormData((prev) => ({
                ...prev,
                versionSource: value as VersionSource,
              }))
            }
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

      {/* Modpart */}
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="counterpartyName">Modpartens navn</Label>
          <Input
            id="counterpartyName"
            value={formData.counterpartyName}
            onChange={(e) =>
              setFormData((prev) => ({
                ...prev,
                counterpartyName: e.target.value,
              }))
            }
            placeholder="f.eks. Acme A/S"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="counterpartyOrg">CVR-nummer</Label>
          <Input
            id="counterpartyOrg"
            value={formData.counterpartyOrg}
            onChange={(e) =>
              setFormData((prev) => ({
                ...prev,
                counterpartyOrg: e.target.value,
              }))
            }
            placeholder="f.eks. 12345678"
          />
        </div>
      </div>

      {/* Datoer */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {/* Startdato */}
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
                selected={formData.startDate}
                onSelect={(date) =>
                  setFormData((prev) => ({ ...prev, startDate: date }))
                }
                initialFocus
              />
            </PopoverContent>
          </Popover>
        </div>

        {/* Slutdato */}
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
                selected={formData.endDate}
                onSelect={(date) =>
                  setFormData((prev) => ({ ...prev, endDate: date }))
                }
                initialFocus
              />
            </PopoverContent>
          </Popover>
        </div>

        {/* Deadline */}
        <div className="space-y-2">
          <Label>Deadline</Label>
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                className={cn(
                  'w-full justify-start text-left font-normal',
                  !formData.deadlineDate && 'text-muted-foreground'
                )}
              >
                <CalendarIcon className="mr-2 h-4 w-4" />
                {formData.deadlineDate
                  ? format(formData.deadlineDate, 'PPP', { locale: da })
                  : 'Vælg dato'}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0">
              <Calendar
                mode="single"
                selected={formData.deadlineDate}
                onSelect={(date) =>
                  setFormData((prev) => ({ ...prev, deadlineDate: date }))
                }
                initialFocus
              />
            </PopoverContent>
          </Popover>
        </div>
      </div>

      {/* Opsigelse og auto-fornyelse */}
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="noticeDays">Opsigelsesfrist (dage)</Label>
          <Input
            id="noticeDays"
            type="number"
            min="0"
            value={formData.noticeDays ?? ''}
            onChange={(e) =>
              setFormData((prev) => ({
                ...prev,
                noticeDays: e.target.value ? parseInt(e.target.value) : undefined,
              }))
            }
            placeholder="f.eks. 90"
          />
        </div>
        <div className="flex items-end pb-2">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={formData.autoRenew}
              onChange={(e) =>
                setFormData((prev) => ({ ...prev, autoRenew: e.target.checked }))
              }
              className="h-4 w-4 rounded border-gray-300"
            />
            <span className="text-sm font-medium">Automatisk fornyelse</span>
          </label>
        </div>
      </div>

      {/* Beskrivelse */}
      <div className="space-y-2">
        <Label htmlFor="description">Beskrivelse</Label>
        <Textarea
          id="description"
          value={formData.description}
          onChange={(e) =>
            setFormData((prev) => ({ ...prev, description: e.target.value }))
          }
          placeholder="Kort beskrivelse af kontrakten..."
          rows={3}
        />
      </div>

      {/* Interne noter */}
      <div className="space-y-2">
        <Label htmlFor="internalNotes">Interne noter</Label>
        <Textarea
          id="internalNotes"
          value={formData.internalNotes}
          onChange={(e) =>
            setFormData((prev) => ({ ...prev, internalNotes: e.target.value }))
          }
          placeholder="Interne noter (kun synlige for din organisation)..."
          rows={3}
        />
      </div>

      {/* Tags */}
      <div className="space-y-2">
        <Label>Tags</Label>
        <div className="flex gap-2">
          <Input
            value={tagInput}
            onChange={(e) => setTagInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                addTag()
              }
            }}
            placeholder="Tilføj tag..."
          />
          <Button type="button" variant="outline" onClick={addTag}>
            Tilføj
          </Button>
        </div>
        {formData.tags.length > 0 && (
          <div className="flex flex-wrap gap-2 mt-2">
            {formData.tags.map((tag) => (
              <span
                key={tag}
                className="inline-flex items-center gap-1 rounded-full bg-blue-100 px-3 py-1 text-xs font-medium text-blue-800"
              >
                {tag}
                <button
                  type="button"
                  onClick={() => removeTag(tag)}
                  className="ml-1 text-blue-600 hover:text-blue-800"
                >
                  ×
                </button>
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Submit */}
      <div className="flex justify-end gap-3 pt-4 border-t">
        <Button
          type="button"
          variant="outline"
          onClick={() => router.back()}
          disabled={isSubmitting}
        >
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
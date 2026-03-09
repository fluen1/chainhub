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
    collectiveAgreement: initialData?.collectiveAgreement || '',
    effectiveDate: initialData?.effectiveDate || null,
    expiryDate: initialData?.expiryDate || null,
    noticePeriodDays: initialData?.noticePeriodDays || null,
    notes: initialData?.notes || '',
  })

  // Beregn minimum sensitivity baseret på valgt type
  const minSensitivity = formData.systemType 
    ? getMinSensitivity(formData.systemType)
    : 'STANDARD'

  // Filtrér sensitivity options baseret på minimum
  const availableSensitivities = SENSITIVITY_OPTIONS.filter(opt => 
    meetsMinimumSensitivity(opt.value, minSensitivity)
  )

  // Opdater sensitivity når type ændres hvis nuværende er for lav
  const handleSystemTypeChange = (value: ContractSystemType) => {
    const newMinSensitivity = getMinSensitivity(value)
    let newSensitivity = formData.sensitivity
    
    if (!meetsMinimumSensitivity(formData.sensitivity, newMinSensitivity)) {
      newSensitivity = newMinSensitivity
    }
    
    setFormData(prev => ({
      ...prev,
      systemType: value,
      sensitivity: newSensitivity,
    }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)

    try {
      if (isEdit && initialData?.id) {
        const input: UpdateContractInput = {
          id: initialData.id,
          displayName: formData.displayName,
          sensitivity: formData.sensitivity,
          deadlineType: formData.deadlineType,
          versionSource: formData.versionSource,
          collectiveAgreement: formData.collectiveAgreement || null,
          effectiveDate: formData.effectiveDate,
          expiryDate: formData.expiryDate,
          noticePeriodDays: formData.noticePeriodDays,
          notes: formData.notes || null,
        }

        const result = await updateContract(input)
        
        if (result.error) {
          toast.error(result.error)
          return
        }

        toast.success('Kontrakten blev opdateret')
        router.push(`/contracts/${initialData.id}`)
      } else {
        const input: CreateContractInput = {
          companyId: formData.companyId,
          systemType: formData.systemType,
          displayName: formData.displayName,
          sensitivity: formData.sensitivity,
          deadlineType: formData.deadlineType,
          versionSource: formData.versionSource,
          collectiveAgreement: formData.collectiveAgreement || null,
          effectiveDate: formData.effectiveDate,
          expiryDate: formData.expiryDate,
          noticePeriodDays: formData.noticePeriodDays,
          notes: formData.notes || null,
        }

        const result = await createContract(input)
        
        if (result.error) {
          toast.error(result.error)
          return
        }

        toast.success('Kontrakten blev oprettet')
        router.push(`/contracts/${result.data!.id}`)
      }
    } catch (error) {
      toast.error('Noget gik galt — prøv igen')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Selskab (kun ved oprettelse) */}
      {!isEdit && (
        <div className="space-y-2">
          <Label htmlFor="companyId">Selskab *</Label>
          <Select
            value={formData.companyId}
            onValueChange={(value) => setFormData(prev => ({ ...prev, companyId: value }))}
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

      {/* Kontrakttype (kun ved oprettelse) */}
      {!isEdit && (
        <div className="space-y-2">
          <Label htmlFor="systemType">Kontrakttype *</Label>
          <Select
            value={formData.systemType}
            onValueChange={handleSystemTypeChange}
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
          {formData.systemType && (
            <p className="text-xs text-muted-foreground">
              Minimum sensitivitet: {SENSITIVITY_OPTIONS.find(s => s.value === minSensitivity)?.label}
            </p>
          )}
        </div>
      )}

      {/* Navn */}
      <div className="space-y-2">
        <Label htmlFor="displayName">Kontraktnavn *</Label>
        <Input
          id="displayName"
          value={formData.displayName}
          onChange={(e) => setFormData(prev => ({ ...prev, displayName: e.target.value }))}
          placeholder="F.eks. Lejekontrakt — Vesterbrogade 42"
          required
        />
      </div>

      {/* Sensitivitet */}
      <div className="space-y-2">
        <Label htmlFor="sensitivity">Sensitivitet</Label>
        <Select
          value={formData.sensitivity}
          onValueChange={(value: SensitivityLevel) => 
            setFormData(prev => ({ ...prev, sensitivity: value }))
          }
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {availableSensitivities.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Deadline type */}
      <div className="space-y-2">
        <Label htmlFor="deadlineType">Fristtype</Label>
        <Select
          value={formData.deadlineType}
          onValueChange={(value: DeadlineType) => 
            setFormData(prev => ({ ...prev, deadlineType: value }))
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
      <div className="space-y-2">
        <Label htmlFor="versionSource">Dokumentkilde</Label>
        <Select
          value={formData.versionSource}
          onValueChange={(value: VersionSource) => 
            setFormData(prev => ({ ...prev, versionSource: value }))
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

      {/* Overenskomst (vis kun ved BRANCHESTANDARD) */}
      {formData.versionSource === 'BRANCHESTANDARD' && (
        <div className="space-y-2">
          <Label htmlFor="collectiveAgreement">Overenskomst</Label>
          <Input
            id="collectiveAgreement"
            value={formData.collectiveAgreement}
            onChange={(e) => setFormData(prev => ({ ...prev, collectiveAgreement: e.target.value }))}
            placeholder="Navn på overenskomst"
          />
        </div>
      )}

      {/* Ikrafttrædelsesdato */}
      <div className="space-y-2">
        <Label>Ikrafttrædelsesdato</Label>
        <Popover>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              className={cn(
                'w-full justify-start text-left font-normal',
                !formData.effectiveDate && 'text-muted-foreground'
              )}
            >
              <CalendarIcon className="mr-2 h-4 w-4" />
              {formData.effectiveDate 
                ? format(formData.effectiveDate, 'PPP', { locale: da })
                : 'Vælg dato'
              }
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar
              mode="single"
              selected={formData.effectiveDate || undefined}
              onSelect={(date) => setFormData(prev => ({ ...prev, effectiveDate: date || null }))}
              locale={da}
            />
          </PopoverContent>
        </Popover>
      </div>

      {/* Udløbsdato */}
      <div className="space-y-2">
        <Label>Udløbsdato</Label>
        <Popover>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              className={cn(
                'w-full justify-start text-left font-normal',
                !formData.expiryDate && 'text-muted-foreground'
              )}
            >
              <CalendarIcon className="mr-2 h-4 w-4" />
              {formData.expiryDate 
                ? format(formData.expiryDate, 'PPP', { locale: da })
                : 'Vælg dato (tom = løbende)'
              }
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar
              mode="single"
              selected={formData.expiryDate || undefined}
              onSelect={(date) => setFormData(prev => ({ ...prev, expiryDate: date || null }))}
              locale={da}
            />
          </PopoverContent>
        </Popover>
        <p className="text-xs text-muted-foreground">
          Lad være tom for løbende kontrakter uden fast udløb
        </p>
      </div>

      {/* Opsigelsesvarsel */}
      <div className="space-y-2">
        <Label htmlFor="noticePeriodDays">Opsigelsesvarsel (dage)</Label>
        <Input
          id="noticePeriodDays"
          type="number"
          min="0"
          value={formData.noticePeriodDays || ''}
          onChange={(e) => setFormData(prev => ({ 
            ...prev, 
            noticePeriodDays: e.target.value ? parseInt(e.target.value, 10) : null 
          }))}
          placeholder="F.eks. 90"
        />
      </div>

      {/* Noter */}
      <div className="space-y-2">
        <Label htmlFor="notes">Noter</Label>
        <Textarea
          id="notes"
          value={formData.notes}
          onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
          placeholder="Eventuelle noter om kontrakten..."
          rows={4}
        />
      </div>

      {/* Submit */}
      <div className="flex gap-4">
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
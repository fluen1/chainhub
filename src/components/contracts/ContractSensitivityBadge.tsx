'use client'

import { SensitivityLevel } from '@prisma/client'
import { cn } from '@/lib/utils'
import { ShieldAlert, Shield, ShieldCheck, Eye, Globe } from 'lucide-react'

interface ContractSensitivityBadgeProps {
  sensitivity: SensitivityLevel
  className?: string
  showIcon?: boolean
}

const SENSITIVITY_CONFIG: Record<SensitivityLevel, { 
  label: string
  className: string
  icon: typeof ShieldAlert
}> = {
  STRENGT_FORTROLIG: {
    label: 'Strengt fortrolig',
    className: 'bg-red-100 text-red-800 border-red-200',
    icon: ShieldAlert,
  },
  FORTROLIG: {
    label: 'Fortrolig',
    className: 'bg-orange-100 text-orange-800 border-orange-200',
    icon: Shield,
  },
  INTERN: {
    label: 'Intern',
    className: 'bg-blue-100 text-blue-800 border-blue-200',
    icon: ShieldCheck,
  },
  STANDARD: {
    label: 'Standard',
    className: 'bg-gray-100 text-gray-800 border-gray-200',
    icon: Eye,
  },
  PUBLIC: {
    label: 'Offentlig',
    className: 'bg-green-100 text-green-800 border-green-200',
    icon: Globe,
  },
}

export function ContractSensitivityBadge({ 
  sensitivity, 
  className,
  showIcon = true,
}: ContractSensitivityBadgeProps) {
  const config = SENSITIVITY_CONFIG[sensitivity]
  const Icon = config.icon

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium border',
        config.className,
        className
      )}
    >
      {showIcon && <Icon className="h-3 w-3" />}
      {config.label}
    </span>
  )
}
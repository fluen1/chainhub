import { cn } from '@/lib/utils'
import Link from 'next/link'

// BButton — B-stil knap: 12px, 1px border, 4px radius. White eller blå primary.
//
// Brug:
//   <BButton onClick={...}>Rediger</BButton>
//   <BButton primary href="/contracts/new">Upload ny version</BButton>

type Common = {
  primary?: boolean
  className?: string
  children: React.ReactNode
}

type AsButton = Common & {
  href?: undefined
  onClick?: () => void
  type?: 'button' | 'submit' | 'reset'
  disabled?: boolean
}

type AsLink = Common & {
  href: string
}

const base =
  'inline-flex items-center justify-center gap-1 whitespace-nowrap rounded-[4px] border px-2.5 py-1 text-[12px] font-medium no-underline transition-colors'
const tones = {
  default:
    'border-b-border-strong bg-white text-b-1 hover:bg-[#f6f8fa] disabled:opacity-50 disabled:cursor-not-allowed',
  primary:
    'border-b-blue-fg bg-b-blue-fg text-white hover:bg-[#0860c7] disabled:opacity-50 disabled:cursor-not-allowed',
}

export function BButton(props: AsButton | AsLink) {
  const { primary, className, children } = props
  const cls = cn(base, primary ? tones.primary : tones.default, className)

  if ('href' in props && props.href) {
    return (
      <Link href={props.href} className={cls}>
        {children}
      </Link>
    )
  }
  const { onClick, type = 'button', disabled } = props as AsButton
  return (
    <button type={type} onClick={onClick} disabled={disabled} className={cls}>
      {children}
    </button>
  )
}

// BAddButton — dashed-border "+ Tilføj X" CTA til panel-footers.
export function BAddButton({
  href,
  onClick,
  children,
}: {
  href?: string
  onClick?: () => void
  children: React.ReactNode
}) {
  const cls =
    'inline-flex items-center gap-1 rounded-[3px] border border-dashed border-b-border-strong bg-transparent px-2 py-0.5 text-[11px] font-medium text-b-2 no-underline hover:border-solid hover:border-b-blue-fg hover:text-b-blue-fg'
  if (href) {
    return (
      <Link href={href} className={cls}>
        {children}
      </Link>
    )
  }
  return (
    <button type="button" onClick={onClick} className={cls}>
      {children}
    </button>
  )
}

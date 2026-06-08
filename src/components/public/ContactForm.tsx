'use client'

import { useState, useTransition } from 'react'
import { submitContactForm } from '@/actions/contact'
import { BButton } from '@/components/ui/b'

const fieldCls =
  'w-full rounded-[4px] border border-b-border-strong bg-white px-2.5 py-1.5 text-[13px] text-b-1 outline-none focus:border-b-blue-fg'
const labelCls = 'mb-1 block text-[12px] font-medium text-b-1'

export function ContactForm() {
  const [isPending, startTransition] = useTransition()
  const [status, setStatus] = useState<'idle' | 'success' | 'error'>('idle')
  const [errorMsg, setErrorMsg] = useState('')

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const form = e.currentTarget
    const data = new FormData(form)
    const payload = {
      name: String(data.get('name') ?? ''),
      email: String(data.get('email') ?? ''),
      company: String(data.get('company') ?? ''),
      message: String(data.get('message') ?? ''),
      honeypot: String(data.get('company_url') ?? ''),
    }
    startTransition(async () => {
      const res = await submitContactForm(payload)
      if ('data' in res) {
        setStatus('success')
        form.reset()
      } else {
        setStatus('error')
        setErrorMsg(res.error)
      }
    })
  }

  if (status === 'success') {
    return (
      <div
        role="status"
        className="rounded-[4px] border border-b-green-fg/30 bg-b-green-fg/5 p-4 text-[13px] text-b-1"
      >
        Tak for din henvendelse — vi vender tilbage hurtigst muligt.
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3" noValidate>
      <div>
        <label htmlFor="name" className={labelCls}>
          Navn
        </label>
        <input id="name" name="name" required className={fieldCls} />
      </div>
      <div>
        <label htmlFor="email" className={labelCls}>
          E-mail
        </label>
        <input id="email" name="email" type="email" required className={fieldCls} />
      </div>
      <div>
        <label htmlFor="company" className={labelCls}>
          Virksomhed (valgfrit)
        </label>
        <input id="company" name="company" className={fieldCls} />
      </div>
      <div>
        <label htmlFor="message" className={labelCls}>
          Besked
        </label>
        <textarea id="message" name="message" required rows={5} className={fieldCls} />
      </div>

      {/* Honeypot: skjult for mennesker, lokker bots. aria-hidden + off-screen + tabIndex=-1. */}
      <div aria-hidden="true" className="absolute left-[-9999px]" tabIndex={-1}>
        <label htmlFor="company_url">Lad dette felt stå tomt</label>
        <input id="company_url" name="company_url" tabIndex={-1} autoComplete="off" />
      </div>

      {status === 'error' && (
        <p role="alert" className="text-[13px] text-b-red-fg">
          {errorMsg}{' '}
          <a href="mailto:kontakt@chainhub.dk" className="underline">
            Send e-mail i stedet
          </a>
        </p>
      )}

      <div>
        <BButton type="submit" primary disabled={isPending} className="px-3 py-1.5 text-[13px]">
          {isPending ? 'Sender…' : 'Send forespørgsel'}
        </BButton>
      </div>
    </form>
  )
}

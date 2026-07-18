'use client'
import { useState } from 'react'
import { api } from '@/lib/api'

interface SidebarLink {
  label: string
  href: string
}

interface EnquiryFormProps {
  kicker?: string
  title: string
  subtitle?: string
  sidebarHeading?: string
  sidebarBody?: string
  urgencyNote?: string
  sidebarLinks?: SidebarLink[]
  subjectLabel?: string
  subjectOptions?: string[]
  detailFields?: string[]        // extra one-line inputs folded into the message
  messageLabel?: string
  submitLabel?: string
  successMessage?: string
  footnote?: string
  anchorId?: string
}

export function EnquiryForm({
  kicker, title, subtitle, sidebarHeading, sidebarBody, urgencyNote, sidebarLinks = [],
  subjectLabel = 'Subject', subjectOptions = [], detailFields = [],
  messageLabel = 'Message', submitLabel = 'Send enquiry',
  successMessage = 'Thank you! Your enquiry has been received.', footnote, anchorId,
}: EnquiryFormProps) {
  const [status, setStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle')

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const form = new FormData(e.currentTarget)
    const details = detailFields
      .map((f) => `${f}: ${String(form.get(f) ?? '').trim()}`)
      .filter((line) => !line.endsWith(': '))
    const payload = {
      name: String(form.get('name') ?? '').trim(),
      email: String(form.get('email') ?? '').trim(),
      subject: subjectOptions.length ? String(form.get('subject') ?? '') : undefined,
      message: [...details, '', String(form.get('message') ?? '').trim()].join('\n').trim(),
    }
    setStatus('sending')
    try {
      await api.post('/api/contact', payload)
      setStatus('sent')
    } catch {
      setStatus('error')
    }
  }

  const inputCls =
    'w-full rounded-lg border border-border bg-card-bg px-4 py-3 text-fg placeholder:text-text-placeholder focus:outline-none focus:ring-2 focus:ring-brand'

  return (
    <section id={anchorId} className="py-20 px-6 bg-bg" aria-label="Enquiry form">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-14">
          {kicker && <p className="text-sm font-semibold uppercase tracking-widest text-brand mb-3">{kicker}</p>}
          <h2 className="font-heading text-3xl md:text-4xl font-bold text-fg">{title}</h2>
          {subtitle && <p className="mt-4 text-muted max-w-2xl mx-auto">{subtitle}</p>}
        </div>
        <div className="grid gap-12 md:grid-cols-[2fr_3fr]">
          <aside>
            {sidebarHeading && <h3 className="font-heading text-2xl font-bold text-fg">{sidebarHeading}</h3>}
            {sidebarBody && <p className="mt-4 text-muted leading-relaxed">{sidebarBody}</p>}
            {urgencyNote && <p className="mt-4 font-semibold text-brand">{urgencyNote}</p>}
            {sidebarLinks.length > 0 && (
              <ul className="mt-8 space-y-3">
                {sidebarLinks.map((l) => (
                  <li key={l.label}>
                    <a href={l.href} target="_blank" rel="noopener noreferrer" className="text-fg hover:text-brand transition-colors">
                      {l.label} →
                    </a>
                  </li>
                ))}
              </ul>
            )}
          </aside>
          {status === 'sent' ? (
            <div role="status" className="rounded-2xl border border-border bg-card-bg p-10 text-center self-start">
              <p className="font-heading text-xl font-semibold text-brand">{successMessage}</p>
            </div>
          ) : (
            <form onSubmit={onSubmit} className="space-y-5">
              <div className="grid gap-5 sm:grid-cols-2">
                <label className="block">
                  <span className="mb-1.5 block text-sm font-semibold text-fg">Name *</span>
                  <input name="name" required className={inputCls} autoComplete="name" />
                </label>
                <label className="block">
                  <span className="mb-1.5 block text-sm font-semibold text-fg">Email *</span>
                  <input name="email" type="email" required className={inputCls} autoComplete="email" />
                </label>
              </div>
              {subjectOptions.length > 0 && (
                <label className="block">
                  <span className="mb-1.5 block text-sm font-semibold text-fg">{subjectLabel} *</span>
                  <select name="subject" required defaultValue="" className={inputCls}>
                    <option value="" disabled>Choose an option</option>
                    {subjectOptions.map((o) => <option key={o} value={o}>{o}</option>)}
                  </select>
                </label>
              )}
              {detailFields.map((f) => (
                <label key={f} className="block">
                  <span className="mb-1.5 block text-sm font-semibold text-fg">{f}</span>
                  <input name={f} className={inputCls} />
                </label>
              ))}
              <label className="block">
                <span className="mb-1.5 block text-sm font-semibold text-fg">{messageLabel} *</span>
                <textarea name="message" required rows={5} className={inputCls} />
              </label>
              {status === 'error' && (
                <p role="alert" className="text-alert font-semibold">
                  Something went wrong sending your enquiry. Please try again, or email us directly.
                </p>
              )}
              <button type="submit" disabled={status === 'sending'} className="rounded-lg bg-brand px-8 py-3.5 font-semibold text-on-brand hover:bg-brand-hover transition-colors disabled:opacity-60">
                {status === 'sending' ? 'Sending…' : submitLabel}
              </button>
              {footnote && <p className="text-sm text-muted">{footnote}</p>}
            </form>
          )}
        </div>
      </div>
    </section>
  )
}

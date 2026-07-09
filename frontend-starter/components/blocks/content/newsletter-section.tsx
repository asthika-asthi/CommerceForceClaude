'use client'
import { useState, FormEvent } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Mail, CheckCircle, AlertCircle, ArrowRight, Loader2 } from 'lucide-react'
import { api } from '@/lib/api'

interface NewsletterSectionProps {
  title?: string
  subtitle?: string
  backgroundImage?: string
  buttonText?: string
}

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())
}

export function NewsletterSection({
  title = 'Stay in the loop',
  subtitle = 'Get the latest offers, new arrivals, and exclusive deals delivered straight to your inbox.',
  backgroundImage,
  buttonText = 'Subscribe',
}: NewsletterSectionProps) {
  const [email, setEmail] = useState('')
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle')
  const [errorMsg, setErrorMsg] = useState('')

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setErrorMsg('')

    if (!isValidEmail(email)) {
      setErrorMsg('Please enter a valid email address.')
      return
    }

    setStatus('loading')
    try {
      await api.post('/api/newsletter/subscribe', { email: email.trim() })
      setStatus('success')
      setEmail('')
    } catch (err: unknown) {
      setStatus('error')
      const message = err instanceof Error ? err.message : 'Something went wrong. Please try again.'
      setErrorMsg(message)
    }
  }

  return (
    <section className="relative py-28 px-4 overflow-hidden">
      {/* Background */}
      {backgroundImage ? (
        <div
          className="absolute inset-0 bg-cover bg-center"
          style={{ backgroundImage: `url("${backgroundImage}")` }}
        />
      ) : (
        <div className="absolute inset-0 bg-gradient-to-br from-brand-dark via-slate-800 to-slate-900" />
      )}
      {/* Dark overlay */}
      <div className="absolute inset-0 bg-black/60" />

      {/* Content */}
      <div className="relative z-10 max-w-2xl mx-auto text-center">
        {/* Icon */}
        <div className="flex justify-center mb-6">
          <div className="w-14 h-14 rounded-2xl bg-brand/20 border border-brand/30 flex items-center justify-center">
            <Mail size={24} className="text-brand" />
          </div>
        </div>

        <h2 className="text-3xl md:text-5xl font-extrabold text-white mb-4 leading-tight">
          {title}
        </h2>
        <p className="text-slate-300 text-lg mb-10 max-w-lg mx-auto">{subtitle}</p>

        {/* Form / States */}
        <AnimatePresence mode="wait">
          {status === 'success' ? (
            <motion.div
              key="success"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              className="flex flex-col items-center gap-3 text-white"
            >
              <CheckCircle size={40} className="text-green-400" />
              <p className="text-xl font-semibold">You&rsquo;re subscribed!</p>
              <p className="text-slate-400 text-sm">Thanks for joining. Check your inbox for a welcome email.</p>
            </motion.div>
          ) : (
            <motion.form
              key="form"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              onSubmit={handleSubmit}
              className="flex flex-col sm:flex-row gap-3 max-w-md mx-auto"
            >
              <div className="flex-1">
                <input
                  type="email"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value)
                    if (status === 'error') { setStatus('idle'); setErrorMsg('') }
                  }}
                  placeholder="your@email.com"
                  required
                  aria-label="Email address"
                  className="w-full px-4 py-3.5 rounded-xl bg-white/10 border border-white/20 text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-brand focus:border-transparent transition-all"
                />
              </div>
              <button
                type="submit"
                disabled={status === 'loading'}
                className="flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl bg-brand hover:bg-brand-hover text-on-brand font-semibold transition-colors disabled:opacity-60 whitespace-nowrap"
              >
                {status === 'loading' ? (
                  <Loader2 size={18} className="animate-spin" />
                ) : (
                  <>
                    {buttonText}
                    <ArrowRight size={16} />
                  </>
                )}
              </button>
            </motion.form>
          )}
        </AnimatePresence>

        {/* Error message */}
        <AnimatePresence>
          {(status === 'error' || errorMsg) && (
            <motion.div
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="flex items-center justify-center gap-2 mt-4 text-red-400 text-sm"
            >
              <AlertCircle size={15} />
              <span>{errorMsg || 'Something went wrong. Please try again.'}</span>
            </motion.div>
          )}
        </AnimatePresence>

        <p className="text-slate-500 text-xs mt-6">No spam, ever. Unsubscribe at any time.</p>
      </div>
    </section>
  )
}

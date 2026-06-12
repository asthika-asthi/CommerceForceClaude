'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { motion } from 'framer-motion'
import { Star, Sparkles, TrendingUp, Gift, ArrowRight, Loader2 } from 'lucide-react'
import { api } from '@/lib/api'
import { useAuthStore } from '@/store/auth'
import type { LoyaltyAccount } from '@/lib/types'

interface LoyaltyWidgetSectionProps {
  title?: string
  subtitle?: string
  joinCtaText?: string
  joinCtaUrl?: string
}

function StatCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: string | number }) {
  return (
    <div className="bg-white/10 border border-white/20 rounded-2xl p-5 flex flex-col items-center gap-2 text-center">
      <div className="text-brand">{icon}</div>
      <p className="text-3xl font-extrabold text-white">{value.toLocaleString()}</p>
      <p className="text-sm text-slate-300">{label}</p>
    </div>
  )
}

function LoggedInWidget({ account }: { account: LoyaltyAccount }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: 'easeOut' }}
      className="max-w-2xl mx-auto text-center"
    >
      {/* Badge */}
      <div className="flex justify-center mb-6">
        <div className="w-16 h-16 rounded-full bg-brand/20 border-2 border-brand flex items-center justify-center">
          <Star size={28} className="text-brand fill-brand" />
        </div>
      </div>

      <h2 className="text-3xl md:text-4xl font-extrabold text-white mb-2">
        Your Loyalty Points
      </h2>
      <p className="text-slate-400 mb-10">Keep earning rewards on every order.</p>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-10">
        <StatCard
          icon={<Sparkles size={22} />}
          label="Available Balance"
          value={account.points_balance}
        />
        <StatCard
          icon={<TrendingUp size={22} />}
          label="Total Earned"
          value={account.total_earned}
        />
        <StatCard
          icon={<Gift size={22} />}
          label="Total Redeemed"
          value={account.total_redeemed}
        />
      </div>

      <Link
        href="/products"
        className="inline-flex items-center gap-2 px-8 py-3.5 rounded-xl bg-brand hover:bg-brand-hover text-white font-semibold transition-colors"
      >
        Earn more points
        <ArrowRight size={16} />
      </Link>
    </motion.div>
  )
}

function GuestWidget({
  title,
  subtitle,
  joinCtaText,
  joinCtaUrl,
}: {
  title: string
  subtitle?: string
  joinCtaText: string
  joinCtaUrl: string
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: 'easeOut' }}
      className="max-w-2xl mx-auto text-center"
    >
      {/* Icon */}
      <div className="flex justify-center mb-6">
        <div className="w-16 h-16 rounded-full bg-brand/20 border-2 border-brand flex items-center justify-center">
          <Sparkles size={28} className="text-brand" />
        </div>
      </div>

      <h2 className="text-3xl md:text-4xl font-extrabold text-white mb-4">{title}</h2>
      {subtitle && (
        <p className="text-slate-300 text-lg mb-8 max-w-lg mx-auto">{subtitle}</p>
      )}

      {/* Benefits list */}
      <ul className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-10 text-slate-300 text-sm">
        {['Earn points on every purchase', 'Exclusive member discounts', 'Redeem for free products'].map((item) => (
          <li key={item} className="flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-brand shrink-0" />
            {item}
          </li>
        ))}
      </ul>

      <Link
        href={joinCtaUrl}
        className="inline-flex items-center gap-2 px-8 py-3.5 rounded-xl bg-brand hover:bg-brand-hover text-white font-semibold transition-colors"
      >
        {joinCtaText}
        <ArrowRight size={16} />
      </Link>

      <p className="mt-4 text-slate-500 text-sm">
        Already a member?{' '}
        <Link href="/login" className="text-brand hover:text-brand-hover underline transition-colors">
          Sign in
        </Link>
      </p>
    </motion.div>
  )
}

export function LoyaltyWidgetSection({
  title = 'Loyalty Rewards',
  subtitle = 'Join our loyalty program and start earning points on every purchase.',
  joinCtaText = 'Start earning points today',
  joinCtaUrl = '/register',
}: LoyaltyWidgetSectionProps) {
  const user = useAuthStore((s) => s.user)
  const authLoading = useAuthStore((s) => s.isLoading)

  const [account, setAccount] = useState<LoyaltyAccount | null>(null)
  const [loyaltyLoading, setLoyaltyLoading] = useState(false)

  useEffect(() => {
    if (!user) return
    setLoyaltyLoading(true)
    api
      .get<LoyaltyAccount>('/api/loyalty/me')
      .then(setAccount)
      .catch(() => setAccount(null))
      .finally(() => setLoyaltyLoading(false))
  }, [user])

  const isLoading = authLoading || (!!user && loyaltyLoading)

  return (
    <section className="py-24 px-4 bg-gradient-to-br from-brand-dark via-slate-900 to-slate-950">
      <div className="max-w-5xl mx-auto">
        {isLoading ? (
          <div className="flex flex-col items-center gap-4 text-white/60 py-16">
            <Loader2 size={32} className="animate-spin text-brand" />
            <p className="text-sm">Loading your rewards...</p>
          </div>
        ) : user && account ? (
          <LoggedInWidget account={account} />
        ) : (
          <GuestWidget
            title={title}
            subtitle={subtitle}
            joinCtaText={joinCtaText}
            joinCtaUrl={joinCtaUrl}
          />
        )}
      </div>
    </section>
  )
}

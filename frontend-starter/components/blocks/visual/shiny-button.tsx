'use client'
export { GlowButton } from '@/components/ui/shiny-button'

import { GlowButton } from '@/components/ui/shiny-button'

interface ShinyButtonBlockProps {
  children?: string
  href?: string
}

export function ShinyButtonBlock({ children = 'Register', href }: ShinyButtonBlockProps) {
  return (
    <section className="py-16 flex justify-center items-center">
      <GlowButton href={href}>{children}</GlowButton>
    </section>
  )
}

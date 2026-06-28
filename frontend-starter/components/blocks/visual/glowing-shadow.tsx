'use client'
import './glowing-shadow.css'
import type { ReactNode } from "react"

export interface GlowingShadowProps {
  children: ReactNode
}

export function GlowingShadow({ children }: GlowingShadowProps) {
  return (
    <section className="py-16 flex justify-center items-center min-h-[400px]">
      <div className="glow-container" role="button">
        <span className="glow"></span>
        <div className="glow-content">{children}</div>
      </div>
    </section>
  )
}

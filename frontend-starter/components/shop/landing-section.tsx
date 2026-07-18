import type { LandingSection, LandingRuntimeData } from "@/lib/types"
import Link from "next/link"
import { BLOCK_REGISTRY } from '@/lib/block-registry'
import { GlowButton } from '@/components/ui/shiny-button'

export function LandingSectionRenderer({ section, data }: { section: LandingSection; data?: LandingRuntimeData }) {
  const style = section.background_color ? { backgroundColor: section.background_color } : undefined

  // Config-sourced section: __block is top-level, not inside section.content
  const asConfig = section as unknown as { __block?: string; requiredPlugin?: string; [key: string]: unknown }
  if (typeof asConfig.__block === 'string') {
    const entry = BLOCK_REGISTRY[asConfig.__block]
    if (!entry) return null
    const { __block: _, requiredPlugin: __, ...props } = asConfig
    const BlockComponent = entry.component
    if (entry.acceptsData) {
      return <BlockComponent {...props} data={data} />
    }
    return <BlockComponent {...props} />
  }

  if (section.section_type === 'block') {
    try {
      const config = JSON.parse(section.content ?? '{}') as Record<string, unknown>
      const { __block, ...props } = config
      if (typeof __block !== 'string') return null
      const entry = BLOCK_REGISTRY[__block]
      if (!entry) return null
      const BlockComponent = entry.component
      if (style) {
        return <section style={style}><BlockComponent {...props} /></section>
      }
      // NOTE: acceptsData is only honored for config-sourced sections above; this
      // DB-sourced path does not forward runtime data. Wire it up if this path
      // ever becomes reachable (backlog item W's admin content layer).
      return <BlockComponent {...props} />
    } catch {
      return null
    }
  }

  if (section.section_type === "hero") {
    return (
      <section style={style} className="relative bg-gradient-to-br from-slate-900 to-slate-700 text-white py-24 px-4">
        <div className="max-w-4xl mx-auto text-center">
          {section.image_url && (
            <img src={section.image_url} alt={section.title ?? ""} className="w-24 h-24 mx-auto mb-6 object-contain" />
          )}
          {section.title && <h1 className="text-4xl md:text-6xl font-bold mb-4">{section.title}</h1>}
          {section.subtitle && <p className="text-xl text-slate-300 mb-8">{section.subtitle}</p>}
          {section.cta_url && section.cta_text && (
            <GlowButton href={section.cta_url}>{section.cta_text}</GlowButton>
          )}
        </div>
      </section>
    )
  }

  if (section.section_type === "features") {
    let features: { title: string; body: string }[] = []
    try { features = JSON.parse(section.content ?? "[]") } catch { /* raw content */ }
    return (
      <section style={style} className="py-20 px-4 bg-white">
        <div className="max-w-5xl mx-auto">
          {section.title && <h2 className="text-3xl font-bold text-center mb-2 text-slate-900">{section.title}</h2>}
          {section.subtitle && <p className="text-slate-500 text-center mb-12">{section.subtitle}</p>}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {features.map((f, i) => (
              <div key={i} className="p-6 border border-slate-100 rounded-xl hover:shadow-md transition-shadow">
                <h3 className="font-semibold text-slate-900 mb-2">{f.title}</h3>
                <p className="text-slate-500 text-sm">{f.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
    )
  }

  if (section.section_type === "testimonials") {
    let testimonials: { name: string; quote: string; role?: string }[] = []
    try { testimonials = JSON.parse(section.content ?? "[]") } catch { /* raw content */ }
    return (
      <section style={style} className="py-20 px-4 bg-slate-50">
        <div className="max-w-5xl mx-auto">
          {section.title && <h2 className="text-3xl font-bold text-center mb-12 text-slate-900">{section.title}</h2>}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {testimonials.map((t, i) => (
              <div key={i} className="bg-white p-6 rounded-xl shadow-sm border border-slate-100">
                <p className="text-slate-600 italic mb-4">"{t.quote}"</p>
                <p className="font-semibold text-slate-900 text-sm">{t.name}</p>
                {t.role && <p className="text-slate-400 text-xs">{t.role}</p>}
              </div>
            ))}
          </div>
        </div>
      </section>
    )
  }

  if (section.section_type === "cta") {
    return (
      <section style={style} className="py-20 px-4 bg-brand text-on-brand text-center">
        <div className="max-w-3xl mx-auto">
          {section.title && <h2 className="text-3xl font-bold mb-4">{section.title}</h2>}
          {section.subtitle && <p className="text-white/70 mb-8">{section.subtitle}</p>}
          {section.cta_url && section.cta_text && (
            <Link
              href={section.cta_url}
              className="inline-block bg-white text-brand-dark hover:bg-slate-50 font-semibold px-8 py-3 rounded-xl text-lg transition-colors"
            >
              {section.cta_text}
            </Link>
          )}
        </div>
      </section>
    )
  }

  if (section.section_type === "html") {
    return (
      <section style={style} className="py-12 px-4">
        <div className="max-w-5xl mx-auto prose prose-slate"
          dangerouslySetInnerHTML={{ __html: section.content ?? "" }} />
      </section>
    )
  }

  // products section — just a placeholder; actual product rendering uses the grid
  return (
    <section style={style} className="py-16 px-4">
      <div className="max-w-6xl mx-auto">
        {section.title && <h2 className="text-2xl font-bold text-slate-900 mb-8 text-center">{section.title}</h2>}
        {section.subtitle && <p className="text-slate-500 text-center mb-8">{section.subtitle}</p>}
      </div>
    </section>
  )
}

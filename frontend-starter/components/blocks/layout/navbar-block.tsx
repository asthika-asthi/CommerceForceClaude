'use client'
// Placeholder — replace with your final navbar TSX.
// Props below mirror the block-defaults entry; adjust to match your design.

interface NavLink {
  label: string
  url: string
}

interface NavbarBlockProps {
  logoText?: string
  logoUrl?: string
  links?: NavLink[]
  ctaLabel?: string
  ctaUrl?: string
}

export function NavbarBlock({
  logoText = 'Store',
  logoUrl = '/',
  links = [],
  ctaLabel,
  ctaUrl,
}: NavbarBlockProps) {
  return (
    <nav className="w-full px-6 py-4 flex items-center justify-between bg-white border-b border-slate-200">
      <a href={logoUrl} className="text-lg font-bold text-brand-dark">{logoText}</a>
      <ul className="hidden md:flex items-center gap-6">
        {links.map((l, i) => (
          <li key={i}>
            <a href={l.url} className="text-sm text-slate-600 hover:text-brand-dark transition-colors">{l.label}</a>
          </li>
        ))}
      </ul>
      {ctaLabel && ctaUrl && (
        <a href={ctaUrl} className="px-4 py-2 rounded-lg bg-brand hover:bg-brand-hover text-on-brand text-sm font-semibold transition-colors">
          {ctaLabel}
        </a>
      )}
    </nav>
  )
}

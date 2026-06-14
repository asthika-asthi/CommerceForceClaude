'use client'
// Placeholder — replace with your final footer TSX.

interface FooterLink {
  label: string
  url: string
}

interface FooterColumn {
  heading: string
  links: FooterLink[]
}

interface FooterBlockProps {
  logoText?: string
  tagline?: string
  columns?: FooterColumn[]
  copyrightText?: string
}

export function FooterBlock({
  logoText = 'Store',
  tagline,
  columns = [],
  copyrightText,
}: FooterBlockProps) {
  return (
    <footer className="bg-slate-900 text-slate-300 px-6 py-12">
      <div className="max-w-6xl mx-auto">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8 mb-10">
          <div>
            <p className="text-white font-bold text-lg mb-2">{logoText}</p>
            {tagline && <p className="text-sm text-slate-400">{tagline}</p>}
          </div>
          {columns.map((col, i) => (
            <div key={i}>
              <p className="text-white font-semibold text-sm mb-3">{col.heading}</p>
              <ul className="space-y-2">
                {col.links.map((l, j) => (
                  <li key={j}>
                    <a href={l.url} className="text-sm hover:text-white transition-colors">{l.label}</a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        {copyrightText && (
          <p className="border-t border-slate-700 pt-6 text-xs text-slate-500">{copyrightText}</p>
        )}
      </div>
    </footer>
  )
}

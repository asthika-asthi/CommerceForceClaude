interface StreamSpotlightProps {
  kicker?: string
  title: string
  bullets?: string[]
  channelName?: string
  channelUrl?: string
  panelTitle?: string
  panelSubtitle?: string
  ctaText?: string
  anchorId?: string
}

export function StreamSpotlight({
  kicker, title, bullets = [], channelName, channelUrl,
  panelTitle, panelSubtitle, ctaText = 'Watch live', anchorId,
}: StreamSpotlightProps) {
  return (
    <section id={anchorId} className="py-20 px-6 bg-dark-deep" aria-label="Live stream">
      <div className="max-w-6xl mx-auto grid gap-12 md:grid-cols-2 items-center">
        {/* Stylised stream preview panel (link-out; no iframe — Twitch embeds
            require a registered parent domain, which breaks local dev) */}
        <a
          href={channelUrl ?? '#'}
          target="_blank"
          rel="noopener noreferrer"
          className="group relative block overflow-hidden rounded-2xl border border-dark-border bg-emphasis-surface aspect-video"
        >
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,var(--brand-shadow),transparent_70%)]" />
          <div className="absolute top-4 left-4 inline-flex items-center gap-2 rounded-md bg-black/60 px-3 py-1 text-xs font-bold text-white">
            <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse motion-reduce:animate-none" aria-hidden />
            LIVE
          </div>
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-center p-6">
            {panelTitle && <span className="font-heading text-xl font-bold text-on-dark-strong">{panelTitle}</span>}
            {panelSubtitle && <span className="text-sm text-on-dark-muted">{panelSubtitle}</span>}
            <span className="mt-4 rounded-lg bg-brand px-6 py-2.5 font-semibold text-on-brand group-hover:bg-brand-hover transition-colors">
              {ctaText}
            </span>
          </div>
        </a>
        <div>
          {kicker && <p className="text-sm font-semibold uppercase tracking-widest text-brand-highlight mb-3">{kicker}</p>}
          <h2 className="font-heading text-3xl md:text-4xl font-bold text-on-dark-strong">{title}</h2>
          {bullets.length > 0 && (
            <ul className="mt-8 space-y-4">
              {bullets.map((b) => (
                <li key={b} className="flex gap-3 text-on-dark">
                  <span className="text-brand-highlight mt-0.5" aria-hidden>✦</span>
                  <span>{b}</span>
                </li>
              ))}
            </ul>
          )}
          {channelName && channelUrl && (
            <a href={channelUrl} target="_blank" rel="noopener noreferrer" className="mt-8 inline-block font-semibold text-brand-highlight hover:underline">
              {channelName} →
            </a>
          )}
        </div>
      </div>
    </section>
  )
}

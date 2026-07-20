interface VideoItem {
  src: string
  caption?: string
  tag?: string
}

interface VideoShowcaseProps {
  kicker?: string
  title: string
  subtitle?: string
  videos: VideoItem[]
  anchorId?: string
}

export function VideoShowcase({ kicker, title, subtitle, videos, anchorId }: VideoShowcaseProps) {
  return (
    <section id={anchorId} className="py-20 px-6 bg-bg" aria-label="Video showcase">
      <div className="max-w-5xl mx-auto">
        <div className="text-center mb-14">
          {kicker && <p className="text-sm font-semibold uppercase tracking-widest text-brand mb-3">{kicker}</p>}
          <h2 className="font-heading text-3xl md:text-4xl font-bold text-fg">{title}</h2>
          {subtitle && <p className="mt-4 text-muted max-w-2xl mx-auto">{subtitle}</p>}
        </div>
        <div className="grid gap-8 md:grid-cols-2">
          {videos.map((video) => (
            <figure key={video.src} className="overflow-hidden rounded-2xl border border-border bg-card-bg">
              {/* preload=metadata keeps page weight low; controls = keyboard accessible */}
              <video src={video.src} controls preload="metadata" playsInline className="w-full aspect-video object-cover bg-black" />
              {(video.caption || video.tag) && (
                <figcaption className="p-4">
                  {video.caption && <span className="block font-semibold text-fg">{video.caption}</span>}
                  {video.tag && <span className="block text-sm text-muted mt-0.5">{video.tag}</span>}
                </figcaption>
              )}
            </figure>
          ))}
        </div>
      </div>
    </section>
  )
}

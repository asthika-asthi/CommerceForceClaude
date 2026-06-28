interface MosaicImage {
  src: string
  alt: string
  linkUrl?: string
}

interface ImageMosaicProps {
  images: MosaicImage[]
  title?: string
}

export function ImageMosaic({ images, title }: ImageMosaicProps) {
  if (!images || images.length === 0) return null
  const display = images.slice(0, 6)

  return (
    <section className="py-16 px-4 bg-bg">
      {title && (
        <h2 className="text-3xl font-bold text-fg text-center mb-10">{title}</h2>
      )}
      <div className="max-w-5xl mx-auto grid grid-cols-2 md:grid-cols-3 gap-3 auto-rows-[200px]">
        {display.map((img, i) => {
          const isTall = i % 3 === 0
          const content = (
            <img
              src={img.src}
              alt={img.alt}
              className="w-full h-full object-cover hover:scale-105 transition-transform duration-500"
            />
          )
          return (
            <div
              key={i}
              className={`overflow-hidden rounded-xl bg-slate-100 ${isTall ? 'row-span-2' : ''}`}
            >
              {img.linkUrl ? (
                <a href={img.linkUrl} className="block w-full h-full">{content}</a>
              ) : (
                content
              )}
            </div>
          )
        })}
      </div>
    </section>
  )
}

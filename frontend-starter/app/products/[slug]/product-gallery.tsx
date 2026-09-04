"use client"

import { useState, useEffect } from "react"
import Image from "next/image"
import { Search, X } from "lucide-react"
import type { ProductImage } from "@/lib/types"

interface Props {
  images: ProductImage[]
  selectedVariantId: string | null
  productName: string
}

export function ProductGallery({ images, selectedVariantId, productName }: Props) {
  const primary = images.find((img) => img.is_primary) ?? images[0]
  const [activeUrl, setActiveUrl] = useState<string | null>(primary?.url ?? null)
  const [zoomOpen, setZoomOpen] = useState(false)

  // When a variant with its own images is selected, jump the main image to it.
  useEffect(() => {
    if (!selectedVariantId) return
    const variantImage = images.find((img) => img.variant_id === selectedVariantId)
    if (variantImage) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- sync displayed image to the selected variant; matches the pre-refactor behaviour
      setActiveUrl(variantImage.url)
    }
  }, [selectedVariantId, images])

  // Close the lightbox on Escape.
  useEffect(() => {
    if (!zoomOpen) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setZoomOpen(false)
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [zoomOpen])

  if (images.length === 0) {
    return (
      <div className="aspect-square bg-slate-100 rounded-2xl flex items-center justify-center text-slate-300 text-6xl">
        &#128230;
      </div>
    )
  }

  const shownUrl = activeUrl ?? images[0].url
  const shownAlt = images.find((img) => img.url === shownUrl)?.alt_text ?? productName

  return (
    <div className="space-y-3">
      <button
        type="button"
        onClick={() => setZoomOpen(true)}
        className="group relative block w-full aspect-square bg-slate-50 rounded-2xl overflow-hidden cursor-zoom-in"
        aria-label="Zoom image"
      >
        <Image
          src={shownUrl}
          alt={shownAlt}
          fill
          unoptimized
          priority
          sizes="(min-width: 768px) 50vw, 100vw"
          className="object-contain"
        />
        <span className="absolute top-3 right-3 rounded-full bg-white/90 text-slate-700 p-2 shadow-sm group-hover:bg-white transition-colors">
          <Search size={16} />
        </span>
      </button>

      {images.length > 1 && (
        <div className="grid grid-cols-4 gap-2 sm:grid-cols-5">
          {images.map((img) => (
            <button
              key={img.id}
              type="button"
              onClick={() => setActiveUrl(img.url)}
              className={[
                "relative aspect-square bg-slate-50 rounded-xl overflow-hidden border-2 transition-colors",
                shownUrl === img.url ? "border-brand-dark" : "border-transparent hover:border-slate-300",
              ].join(" ")}
            >
              <Image src={img.url} alt={img.alt_text ?? ""} fill unoptimized sizes="20vw" className="object-contain" />
            </button>
          ))}
        </div>
      )}

      {zoomOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={`${productName} image`}
          className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4"
          onClick={() => setZoomOpen(false)}
        >
          <button
            type="button"
            className="absolute top-4 right-4 text-white/90 hover:text-white"
            aria-label="Close"
            onClick={() => setZoomOpen(false)}
          >
            <X size={28} />
          </button>
          <div className="relative w-full max-w-3xl aspect-square" onClick={(e) => e.stopPropagation()}>
            <Image src={shownUrl} alt={shownAlt} fill unoptimized sizes="90vw" className="object-contain" />
          </div>
        </div>
      )}
    </div>
  )
}

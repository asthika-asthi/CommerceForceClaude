import { serverFetch } from "@/lib/api"

interface PromotionBanner {
  id: string
  headline: string
  body: string
  cta_text: string
  cta_url: string
  image_url?: string | null
  expires_at?: string | null
  is_active: boolean
}

interface Props {
  [key: string]: unknown
}

export async function PromotionsBanner(_props: Props) {
  let banner: PromotionBanner | null = null
  try {
    banner = await serverFetch<PromotionBanner | null>("/api/promotions/active")
  } catch {
    return null
  }
  if (!banner) return null

  return (
    <section className="w-full bg-brand-dark text-white py-8 px-4">
      <div className="max-w-4xl mx-auto text-center">
        <h2 className="text-2xl font-bold mb-2">{banner.headline}</h2>
        <p className="text-lg mb-4 opacity-90">{banner.body}</p>
        {banner.expires_at && (
          <p className="text-sm mb-4 opacity-75">
            Offer ends {new Date(banner.expires_at).toLocaleDateString()}
          </p>
        )}
        <a
          href={banner.cta_url}
          className="inline-block bg-brand text-fg font-semibold px-6 py-3 rounded-lg hover:bg-brand-hover transition-colors"
        >
          {banner.cta_text}
        </a>
      </div>
    </section>
  )
}

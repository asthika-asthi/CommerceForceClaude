import type { MetadataRoute } from "next"

const BASE = process.env.NEXT_PUBLIC_STOREFRONT_URL ?? "http://localhost:3000"

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/account", "/checkout", "/cart", "/login", "/register", "/reset-password", "/forgot-password", "/dev"],
      },
    ],
    sitemap: `${BASE}/sitemap.xml`,
  }
}

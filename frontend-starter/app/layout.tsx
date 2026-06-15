import type { Metadata } from "next"
import { Poppins } from "next/font/google"
import "./globals.css"
import { Providers } from "./providers"
import { Navbar } from "@/components/layout/navbar"
import { Footer } from "@/components/layout/footer"
import { ChatWidget } from "@/components/chat-widget"
import { BottomNav } from "@/components/layout/bottom-nav"
import { serverFetch } from "@/lib/api"
import type { BrandingConfig } from "@/lib/types"
import { getBrandCss, getFontLink, getStoreConfig, getLandingConfig } from "@/lib/landing-config"

const poppins = Poppins({
  variable: "--font-poppins",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
})

export async function generateMetadata(): Promise<Metadata> {
  const branding = await serverFetch<BrandingConfig>("/api/branding")
  const storeFromConfig = getStoreConfig()
  const storeName = branding?.store_name || storeFromConfig.name
  const tagline = branding?.tagline || storeFromConfig.tagline
  return {
    title: { default: storeName ?? "Store", template: `%s | ${storeName ?? "Store"}` },
    description: tagline,
  }
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const branding = await serverFetch<BrandingConfig>("/api/branding")

  const brandCss = getBrandCss()
  const fontLink = getFontLink()
  const storeFromConfig = getStoreConfig()
  const fontName = (() => { try { return getLandingConfig().brand?.font ?? null } catch { return null } })()

  // Merge: DB branding wins over config, config wins over hardcoded defaults
  const effectiveBranding: BrandingConfig = {
    id: branding?.id ?? "default",
    store_name: branding?.store_name || storeFromConfig.name || "My Store",
    tagline: branding?.tagline || storeFromConfig.tagline,
    logo_url: branding?.logo_url || storeFromConfig.logo_url,
    favicon_url: branding?.favicon_url,
    primary_color: branding?.primary_color ?? "#000000",
    secondary_color: branding?.secondary_color ?? "#000000",
    font_family: branding?.font_family ?? "Poppins",
    custom_css: branding?.custom_css,
    contact_email: branding?.contact_email || storeFromConfig.contact_email,
    contact_phone: branding?.contact_phone || storeFromConfig.contact_phone,
    social_links: branding?.social_links,
  }

  return (
    <html lang="en" className={`${poppins.variable} h-full`}>
      <head>
        {fontLink && <link rel="stylesheet" href={fontLink} />}
        {fontLink && fontName && (
          <style>{`:root { --font-sans: ${JSON.stringify(fontName)}, system-ui, sans-serif }`}</style>
        )}
        {brandCss && <style>{brandCss}</style>}
        {effectiveBranding?.custom_css && <style>{effectiveBranding.custom_css}</style>}
      </head>
      <body className="min-h-full flex flex-col antialiased">
        <Providers>
          <Navbar branding={effectiveBranding} />
          <main className="flex-1">{children}</main>
          <Footer branding={effectiveBranding} />
          <ChatWidget />
          <BottomNav />
        </Providers>
      </body>
    </html>
  )
}

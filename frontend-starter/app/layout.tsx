import type { Metadata } from "next"
import { Poppins } from "next/font/google"
import "./globals.css"
import { Providers } from "./providers"
import { Navbar } from "@/components/layout/navbar"
import { Footer } from "@/components/layout/footer"
import { Topbar } from "@/components/layout/topbar"
import { CategoriesNav } from "@/components/layout/categories-nav"
import { ChatWidget } from "@/components/chat-widget"
import { BottomNav } from "@/components/layout/bottom-nav"
import { CookieConsent } from "@/components/cookie-consent"
import { serverFetch } from "@/lib/api"
import { deriveTheme } from "@/lib/theme-colors"
import type { BrandingConfig, Category } from "@/lib/types"

const poppins = Poppins({
  variable: "--font-poppins",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
})

export async function generateMetadata(): Promise<Metadata> {
  const branding = await serverFetch<BrandingConfig>("/api/branding")
  // Blank store name is a supported state (some clients are logo-only):
  // fall back to the tagline for the tab title and drop the "%s | name" suffix.
  const storeName = branding?.store_name?.trim()
  const fallbackTitle = branding?.tagline?.trim() || "Welcome"
  return {
    title: storeName
      ? { default: storeName, template: `%s | ${storeName}` }
      : { default: fallbackTitle, template: "%s" },
    description: branding?.tagline,
  }
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const [branding, categories, health] = await Promise.all([
    serverFetch<BrandingConfig>("/api/branding"),
    serverFetch<Category[]>("/api/categories").catch(() => [] as Category[]),
    serverFetch<{ plugins: string[] }>("/api/health").catch(() => null),
  ])

  const activeCategories = (categories ?? []).filter(c => c.is_active)
  const enabledPlugins: string[] = health?.plugins ?? []

  // Admin-chosen colours override the theme-file defaults. Inline style on
  // <html> beats stylesheet :root declarations regardless of head ordering.
  const themeVars = deriveTheme(branding?.theme_colors) as React.CSSProperties

  return (
    <html lang="en" className={`${poppins.variable} h-full`} style={themeVars}>
      <head>
        {branding?.favicon_url && <link rel="icon" href={branding.favicon_url} />}
        {branding?.custom_css && <style>{branding.custom_css}</style>}
      </head>
      <body className="min-h-full flex flex-col antialiased">
        <Providers enabledPlugins={enabledPlugins}>
          <Topbar branding={branding} />
          <Navbar branding={branding} enabledPlugins={enabledPlugins} />
          <CategoriesNav />
          <main className="flex-1">{children}</main>
          <Footer branding={branding} categories={activeCategories} />
          <ChatWidget />
          <BottomNav />
          <CookieConsent />
        </Providers>
      </body>
    </html>
  )
}

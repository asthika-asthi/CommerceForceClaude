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
import { serverFetch } from "@/lib/api"
import type { BrandingConfig } from "@/lib/types"

const poppins = Poppins({
  variable: "--font-poppins",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
})

export async function generateMetadata(): Promise<Metadata> {
  const branding = await serverFetch<BrandingConfig>("/api/branding")
  return {
    title: { default: branding?.store_name ?? "Store", template: `%s | ${branding?.store_name ?? "Store"}` },
    description: branding?.tagline,
  }
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const branding = await serverFetch<BrandingConfig>("/api/branding")

  return (
    <html lang="en" className={`${poppins.variable} h-full`}>
      <head>
        {branding?.favicon_url && <link rel="icon" href={branding.favicon_url} />}
        {branding?.custom_css && <style>{branding.custom_css}</style>}
      </head>
      <body className="min-h-full flex flex-col antialiased">
        <Providers>
          <Topbar branding={branding} />
          <Navbar branding={branding} />
          <CategoriesNav />
          <main className="flex-1">{children}</main>
          <Footer branding={branding} />
          <ChatWidget />
          <BottomNav />
        </Providers>
      </body>
    </html>
  )
}

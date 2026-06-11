import type { Metadata } from "next"
import { Poppins } from "next/font/google"
import "./globals.css"
import { Providers } from "./providers"
import { Navbar } from "@/components/layout/navbar"
import { Footer } from "@/components/layout/footer"
import { ChatWidget } from "@/components/chat-widget"
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
      {branding?.custom_css && (
        <head><style>{branding.custom_css}</style></head>
      )}
      <body className="min-h-full flex flex-col antialiased">
        <Providers>
          <Navbar branding={branding} />
          <main className="flex-1">{children}</main>
          <Footer branding={branding} />
          <ChatWidget />
        </Providers>
      </body>
    </html>
  )
}

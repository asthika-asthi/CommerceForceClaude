"use client"
import { usePathname } from "next/navigation"

const TITLES: Record<string, string> = {
  "/products": "Products",
  "/categories": "Categories",
  "/orders": "Orders",
  "/coupons": "Coupons",
  "/loyalty": "Loyalty Program",
  "/newsletter": "Newsletter",
  "/rfq": "Requests for Quote",
  "/credit": "Credit Accounts",
  "/inventory": "Inventory",
  "/branding": "Branding",
  "/landing-page": "Page Content",
}

export function Header() {
  const pathname = usePathname()
  const base = "/" + pathname.split("/")[1]
  const title = TITLES[base] ?? "Dashboard"

  return (
    <header className="h-14 bg-white border-b border-slate-200 flex items-center px-6 flex-shrink-0">
      <h1 className="text-base font-semibold text-slate-800">{title}</h1>
    </header>
  )
}

import { serverFetch } from "@/lib/api"
import type { Category } from "@/lib/types"
import Link from "next/link"

export async function CategoriesNav() {
  let categories: Category[] = []
  try {
    const data = await serverFetch<Category[]>("/api/categories")
    categories = (data ?? []).filter(c => c.is_active).slice(0, 6)
  } catch {
    // render without dynamic categories
  }

  const linkCls = "text-[#CBD8EE] text-[13px] font-medium px-[18px] py-[14px] border-b-[3px] border-transparent -mb-[3px] hover:text-white hover:border-white hover:bg-white/5 transition-all whitespace-nowrap"

  return (
    <nav className="bg-brand-dark border-b-[3px] border-brand">
      <div className="max-w-[1280px] mx-auto px-10 flex items-center">
        <Link href="/" className={linkCls}>Home</Link>
        {categories.map(cat => (
          <Link
            key={cat.id}
            href={`/products?category=${cat.slug}`}
            className={`${linkCls} flex items-center gap-1.5`}
          >
            {cat.name}
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M6 9l6 6 6-6"/>
            </svg>
          </Link>
        ))}
        <Link href="/bespoke" className={linkCls}>Bespoke Orders</Link>
        <Link href="/trade" className={linkCls}>Trade Accounts</Link>
        <div className="flex-1" />
        <Link href="/products?sale=true" className="text-[#D4A017] text-[13px] font-semibold px-[18px] py-[14px] border-b-[3px] border-transparent -mb-[3px] hover:text-[#f0c040] hover:border-[#f0c040] hover:bg-white/5 transition-all whitespace-nowrap">
          🏷️ Special Offers
        </Link>
      </div>
    </nav>
  )
}

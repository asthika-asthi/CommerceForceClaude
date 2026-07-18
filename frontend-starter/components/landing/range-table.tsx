import Link from "next/link"
import type { Product, Category } from "@/lib/types"

interface Props {
  products: Product[]
  categories?: Category[]
}

export function RangeTable({ products, categories = [] }: Props) {
  if (products.length === 0) return null

  const categoryNames = new Map(categories.map(c => [c.id, c.name]))

  return (
    <div className="max-w-[1280px] mx-auto px-10 pb-14">
      <div className="flex justify-between items-baseline mb-8">
        <h2 className="text-[26px] font-bold text-brand-dark">
          Product range <span className="text-brand">quick reference</span>
        </h2>
        <Link href="/products" className="text-[13px] font-semibold text-brand flex items-center gap-1 hover:text-brand-hover transition-colors">
          Full catalogue →
        </Link>
      </div>
      <div className="bg-white border border-border rounded-xl overflow-hidden">
        <table className="w-full border-collapse">
          <thead>
            <tr>
              {["Product", "Category", "Description", "Availability"].map(h => (
                <th key={h} className="bg-brand-dark text-on-dark-strong text-[12px] font-semibold text-left px-5 py-3.5 tracking-[0.4px] uppercase">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {products.map((product, i) => (
              <tr key={product.id} className={`${i % 2 === 1 ? "bg-surface-alt" : ""} hover:bg-brand-tint transition-colors`}>
                <td className="px-5 py-3 text-[13px] text-fg border-b border-border-subtle">
                  <Link href={`/products/${product.slug}`} className="font-semibold hover:text-brand transition-colors">
                    {product.name}
                  </Link>
                </td>
                <td className="px-5 py-3 text-[13px] text-fg border-b border-border-subtle">
                  {(product.category_id && categoryNames.get(product.category_id)) ?? "—"}
                </td>
                <td className="px-5 py-3 text-[13px] text-fg border-b border-border-subtle max-w-[280px]">
                  {product.description ? product.description.slice(0, 80) + (product.description.length > 80 ? "…" : "") : "—"}
                </td>
                <td className="px-5 py-3 text-[13px] border-b border-border-subtle">
                  {product.stock_quantity > 0 ? (
                    <span className="inline-block text-[10px] font-bold px-2 py-0.5 rounded-full text-[#059669] bg-[#D1FAE5]">In stock</span>
                  ) : (
                    <span className="inline-block text-[10px] font-bold px-2 py-0.5 rounded-full text-[#DC2626] bg-[#FEE2E2]">Out of stock</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

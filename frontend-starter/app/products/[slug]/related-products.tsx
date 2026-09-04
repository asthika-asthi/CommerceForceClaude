import { ProductCard } from "@/components/shop/product-card"
import type { Product } from "@/lib/types"

interface Props {
  products: Product[]
  currentId: string
}

export function RelatedProducts({ products, currentId }: Props) {
  const related = products.filter((p) => p.id !== currentId).slice(0, 4)
  if (related.length === 0) return null

  return (
    <section className="mt-16">
      <h2 className="text-xl font-bold text-slate-900 mb-6">Related products</h2>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
        {related.map((p) => (
          <ProductCard key={p.id} product={p} />
        ))}
      </div>
    </section>
  )
}

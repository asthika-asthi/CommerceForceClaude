import Link from "next/link"
import type { CategoryPathItem } from "@/lib/types"

interface Props {
  sku?: string | null
  categoryLeaf: CategoryPathItem | null
  tags?: string | null
}

/** The "SKU · Category · Tags" line beneath the buy box. Rows omit themselves when empty. */
export function ProductMeta({ sku, categoryLeaf, tags }: Props) {
  const tagList = (tags ?? "")
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean)

  const hasAny = !!sku || !!categoryLeaf || tagList.length > 0
  if (!hasAny) return null

  return (
    <dl className="mt-5 pt-4 border-t border-border space-y-1 text-[13px] text-muted">
      {sku && (
        <div className="flex gap-1.5">
          <dt className="font-medium text-fg">SKU:</dt>
          <dd>{sku}</dd>
        </div>
      )}
      {categoryLeaf && (
        <div className="flex gap-1.5">
          <dt className="font-medium text-fg">Category:</dt>
          <dd>
            <Link
              href={`/products?category=${categoryLeaf.id}`}
              className="hover:text-brand-dark transition-colors"
            >
              {categoryLeaf.name}
            </Link>
          </dd>
        </div>
      )}
      {tagList.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          <dt className="font-medium text-fg">Tags:</dt>
          <dd className="flex flex-wrap gap-1.5">
            {tagList.map((tag) => (
              <Link
                key={tag}
                href={`/products?q=${encodeURIComponent(tag)}`}
                className="hover:text-brand-dark transition-colors"
              >
                {tag}
              </Link>
            ))}
          </dd>
        </div>
      )}
    </dl>
  )
}

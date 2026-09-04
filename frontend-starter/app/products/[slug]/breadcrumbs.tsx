import Link from "next/link"
import { ChevronRight } from "lucide-react"
import type { CategoryPathItem } from "@/lib/types"

interface Props {
  path: CategoryPathItem[] | null
  productName: string
}

function Crumb({ children, href }: { children: React.ReactNode; href?: string }) {
  if (!href) return <span className="text-fg">{children}</span>
  return (
    <Link href={href} className="text-muted hover:text-brand-dark transition-colors">
      {children}
    </Link>
  )
}

export function Breadcrumbs({ path, productName }: Props) {
  const trail: { label: string; href?: string }[] = [{ label: "Home", href: "/" }]

  if (path && path.length > 0) {
    for (const cat of path) {
      trail.push({ label: cat.name, href: `/products?category=${cat.id}` })
    }
  } else {
    trail.push({ label: "Shop", href: "/products" })
  }
  trail.push({ label: productName })

  return (
    <nav aria-label="Breadcrumb" className="mb-6">
      <ol className="flex flex-wrap items-center gap-1.5 text-[13px]">
        {trail.map((item, i) => {
          const isLast = i === trail.length - 1
          return (
            <li key={`${item.label}-${i}`} className="flex items-center gap-1.5">
              {i > 0 && <ChevronRight size={13} className="text-muted/60 shrink-0" aria-hidden="true" />}
              {isLast ? (
                <span aria-current="page" className="text-fg font-medium line-clamp-1">
                  {item.label}
                </span>
              ) : (
                <Crumb href={item.href}>{item.label}</Crumb>
              )}
            </li>
          )
        })}
      </ol>
    </nav>
  )
}

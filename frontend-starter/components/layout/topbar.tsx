import Link from 'next/link'

interface TopbarItem {
  icon?: string
  text: string
  href?: string
}

interface TopbarLink {
  label: string
  href: string
}

interface TopbarProps {
  leftItems?: TopbarItem[]
  rightLinks?: TopbarLink[]
}

export function Topbar({ leftItems = [], rightLinks = [] }: TopbarProps) {
  if (leftItems.length === 0 && rightLinks.length === 0) return null
  return (
    <div className="bg-[#1B2A4A] text-[#CBD8EE] text-[12px] hidden md:block">
      <div className="max-w-6xl mx-auto px-6 py-1.5 flex items-center justify-between gap-4">
        <div className="flex items-center gap-5 flex-wrap">
          {leftItems.map((item, i) => (
            item.href ? (
              <a key={i} href={item.href} className="flex items-center gap-1.5 hover:text-white transition-colors">
                {item.icon && <span>{item.icon}</span>}
                <span>{item.text}</span>
              </a>
            ) : (
              <span key={i} className="flex items-center gap-1.5">
                {item.icon && <span>{item.icon}</span>}
                <span>{item.text}</span>
              </span>
            )
          ))}
        </div>
        <div className="flex items-center gap-4 flex-shrink-0">
          {rightLinks.map((link, i) => (
            <Link
              key={i}
              href={link.href}
              className="hover:text-white transition-colors"
            >
              {link.label}
            </Link>
          ))}
        </div>
      </div>
    </div>
  )
}

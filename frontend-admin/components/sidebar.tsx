"use client"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { useQuery } from "@tanstack/react-query"
import { api } from "@/lib/api"
import type { PluginMenu } from "@/lib/types"
import {
  LayoutDashboard, Package, Tag, ShoppingCart, Ticket, Star,
  Mail, FileText, CreditCard, Warehouse, Palette, Layout,
  MessageCircle, BarChart2, LogOut, Megaphone,
} from "lucide-react"
import { useAuthStore } from "@/store/auth"
import { useRouter } from "next/navigation"

const ICON_MAP: Record<string, React.ReactNode> = {
  "layout-dashboard": <LayoutDashboard size={16} />,
  "package": <Package size={16} />,
  "tag": <Tag size={16} />,
  "shopping-cart": <ShoppingCart size={16} />,
  "ticket": <Ticket size={16} />,
  "star": <Star size={16} />,
  "mail": <Mail size={16} />,
  "file-text": <FileText size={16} />,
  "credit-card": <CreditCard size={16} />,
  "warehouse": <Warehouse size={16} />,
  "palette": <Palette size={16} />,
  "layout": <Layout size={16} />,
  "message-circle": <MessageCircle size={16} />,
  "bar-chart": <BarChart2 size={16} />,
  "megaphone": <Megaphone size={16} />,
}

function NavItem({ href, label, icon }: { href: string; label: string; icon?: React.ReactNode }) {
  const pathname = usePathname()
  const active = pathname === href || (href !== "/" && pathname.startsWith(href))
  return (
    <Link
      href={href}
      className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-colors ${
        active
          ? "bg-blue-600 text-white"
          : "text-slate-300 hover:bg-slate-700 hover:text-white"
      }`}
    >
      {icon}
      {label}
    </Link>
  )
}

export function Sidebar() {
  const { data: menuData } = useQuery<{ admin_menu: PluginMenu[] }>({
    queryKey: ["menu"],
    queryFn: () => api.get<{ admin_menu: PluginMenu[] }>("/api/menu"),
    staleTime: 5 * 60_000,
  })
  const menu = menuData?.admin_menu
  const logout = useAuthStore((s) => s.logout)
  const user = useAuthStore((s) => s.user)
  const router = useRouter()

  async function handleLogout() {
    await logout()
    router.push("/login")
  }

  return (
    <aside className="w-60 flex flex-col bg-slate-900 text-slate-100 h-full">
      {/* Brand */}
      <div className="px-4 py-5 border-b border-slate-700">
        <span className="text-lg font-bold tracking-tight text-white">CommerceForce</span>
        <p className="text-xs text-slate-400 mt-0.5">Admin</p>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-1">
        <NavItem href="/products" label="Products" icon={<Package size={16} />} />
        <NavItem href="/categories" label="Categories" icon={<Tag size={16} />} />
        <NavItem href="/orders" label="Orders" icon={<ShoppingCart size={16} />} />

        {/* Dynamic plugin menu items */}
        {menu?.map((plugin) =>
          plugin.items.map((item) => {
            // Skip items already shown statically (exact match only, not sub-paths)
            const staticPaths = ["/admin/products", "/admin/categories", "/admin/orders"]
            if (staticPaths.includes(item.path)) return null
            // Map /admin/X → /X
            const href = item.path.replace(/^\/admin/, "")
            return (
              <NavItem
                key={item.path}
                href={href}
                label={item.label}
                icon={ICON_MAP[plugin.icon] ?? <BarChart2 size={16} />}
              />
            )
          }),
        )}
      </nav>

      {/* User footer */}
      <div className="px-4 py-4 border-t border-slate-700">
        <div className="text-xs text-slate-400 mb-2">
          {user?.first_name} {user?.last_name}
          <span className="ml-1 text-slate-500">({user?.role})</span>
        </div>
        <button
          onClick={handleLogout}
          className="flex items-center gap-2 text-sm text-slate-400 hover:text-white transition-colors"
        >
          <LogOut size={14} /> Sign out
        </button>
      </div>
    </aside>
  )
}

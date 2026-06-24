'use client'
import Link from 'next/link'
import { Home, Package, ShoppingCart, User } from 'lucide-react'
import { NavBar } from '@/components/ui/tubelight-navbar'
import { usePlugin } from '@/lib/plugins-context'

export function BottomNav() {
  const cartEnabled = usePlugin("cart")

  const items = [
    { name: 'Home',     url: '/',         icon: Home },
    { name: 'Products', url: '/products', icon: Package },
    ...(cartEnabled ? [{ name: 'Cart', url: '/cart', icon: ShoppingCart }] : []),
    { name: 'Account',  url: '/account',  icon: User },
  ]

  return <NavBar items={items} LinkComponent={Link} />
}

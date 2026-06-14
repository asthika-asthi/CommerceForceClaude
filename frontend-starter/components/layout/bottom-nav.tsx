'use client'
import Link from 'next/link'
import { Home, Package, ShoppingCart, User } from 'lucide-react'
import { NavBar } from '@/components/ui/tubelight-navbar'

const items = [
  { name: 'Home',     url: '/',         icon: Home },
  { name: 'Products', url: '/products', icon: Package },
  { name: 'Cart',     url: '/cart',     icon: ShoppingCart },
  { name: 'Account',  url: '/account',  icon: User },
]

export function BottomNav() {
  return <NavBar items={items} LinkComponent={Link} />
}

'use client'
import Link from 'next/link'
import {
  Home, User, Briefcase, FileText, ShoppingCart, Heart,
  Search, Menu, Star, Settings, Bell, Info, Tag, Package,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { NavBar } from '@/components/ui/tubelight-navbar'

// Maps JSON icon name strings to Lucide components.
// Add more entries here as needed.
const ICON_MAP: Record<string, LucideIcon> = {
  Home, User, Briefcase, FileText, ShoppingCart, Heart,
  Search, Menu, Star, Settings, Bell, Info, Tag, Package,
}

interface NavItemConfig {
  name: string
  url: string
  icon: string
}

export interface TubelightNavbarBlockProps {
  items?: NavItemConfig[]
  className?: string
}

export function TubelightNavbarBlock({ items = [], className }: TubelightNavbarBlockProps) {
  const navItems = items.map((item) => ({
    name: item.name,
    url: item.url,
    icon: ICON_MAP[item.icon] ?? Home,
  }))

  if (navItems.length === 0) return null

  return <NavBar items={navItems} className={className} LinkComponent={Link} />
}

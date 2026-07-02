"use client"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { useEffect, useState } from "react"
import { useAuthStore } from "@/store/auth"
import { useCartStore } from "@/store/cart"
import { PluginsProvider } from "@/lib/plugins-context"

function AppInit({ children }: { children: React.ReactNode }) {
  const initAuth = useAuthStore((s) => s.init)
  const fetchCart = useCartStore((s) => s.fetch)

  useEffect(() => {
    // Run in background — do NOT block rendering. Blocking (return null) hid
    // all links from the DOM during hydration, making them unclickable on first
    // load until the promises resolved.
    initAuth()
    fetchCart()
  }, [initAuth, fetchCart])

  return <>{children}</>
}

export function Providers({
  children,
  enabledPlugins = [],
}: {
  children: React.ReactNode
  enabledPlugins: string[]
}) {
  const [queryClient] = useState(
    () => new QueryClient({ defaultOptions: { queries: { staleTime: 60_000, retry: 1 } } }),
  )
  return (
    <QueryClientProvider client={queryClient}>
      <PluginsProvider plugins={enabledPlugins}>
        <AppInit>{children}</AppInit>
      </PluginsProvider>
    </QueryClientProvider>
  )
}

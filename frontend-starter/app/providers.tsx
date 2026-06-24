"use client"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { useEffect, useState } from "react"
import { useAuthStore } from "@/store/auth"
import { useCartStore } from "@/store/cart"
import { PluginsProvider } from "@/lib/plugins-context"

function AppInit({ children }: { children: React.ReactNode }) {
  const initAuth = useAuthStore((s) => s.init)
  const fetchCart = useCartStore((s) => s.fetch)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    Promise.all([initAuth(), fetchCart()]).finally(() => setReady(true))
  }, [initAuth, fetchCart])

  if (!ready) return null
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

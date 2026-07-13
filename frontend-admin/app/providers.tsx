"use client"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { useEffect, useState } from "react"
import { useAuthStore } from "@/store/auth"
import { useChunkErrorReload } from "@/lib/chunk-error-reload"

function AuthInit({ children }: { children: React.ReactNode }) {
  const init = useAuthStore((s) => s.init)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    init().finally(() => setReady(true))
  }, [init])

  if (!ready) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return <>{children}</>
}

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: { queries: { staleTime: 30_000, retry: 1 } },
      }),
  )

  useChunkErrorReload()

  return (
    <QueryClientProvider client={queryClient}>
      <AuthInit>{children}</AuthInit>
    </QueryClientProvider>
  )
}

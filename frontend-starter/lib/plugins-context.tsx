"use client"
import { createContext, useContext } from "react"

const PluginsContext = createContext<Set<string>>(new Set())

export function PluginsProvider({
  children,
  plugins,
}: {
  children: React.ReactNode
  plugins: string[]
}) {
  return (
    <PluginsContext.Provider value={new Set(plugins)}>
      {children}
    </PluginsContext.Provider>
  )
}

/**
 * Returns true if the named plugin is enabled.
 * Defaults to true when the plugin list is empty (health endpoint unavailable)
 * so the UI stays visible rather than vanishing silently.
 */
export function usePlugin(name: string): boolean {
  const plugins = useContext(PluginsContext)
  if (plugins.size === 0) return true
  return plugins.has(name)
}

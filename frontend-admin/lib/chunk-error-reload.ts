"use client"
import { useEffect } from "react"

const RELOAD_FLAG = "cf-admin-chunk-reload"

function isChunkLoadError(error: unknown): boolean {
  if (!(error instanceof Error)) return false
  return error.name === "ChunkLoadError" || /Loading (chunk|CSS chunk) [\w./-]+ failed/.test(error.message)
}

/**
 * A stale client (old chunk hashes) after a new deploy throws ChunkLoadError when it
 * tries to lazy-load a chunk that no longer exists on the server. Reload once to pick
 * up the new build; a sessionStorage flag stops a reload loop if the error persists.
 */
export function useChunkErrorReload() {
  useEffect(() => {
    const reloadOnce = () => {
      if (sessionStorage.getItem(RELOAD_FLAG)) return
      sessionStorage.setItem(RELOAD_FLAG, "1")
      window.location.reload()
    }

    const onError = (event: ErrorEvent) => {
      if (isChunkLoadError(event.error)) reloadOnce()
    }
    const onRejection = (event: PromiseRejectionEvent) => {
      if (isChunkLoadError(event.reason)) reloadOnce()
    }

    window.addEventListener("error", onError)
    window.addEventListener("unhandledrejection", onRejection)

    // The page loaded cleanly on the current build — clear the flag so a future,
    // unrelated deploy can still trigger a reload instead of being suppressed forever.
    const clearFlag = window.setTimeout(() => sessionStorage.removeItem(RELOAD_FLAG), 5000)

    return () => {
      window.removeEventListener("error", onError)
      window.removeEventListener("unhandledrejection", onRejection)
      window.clearTimeout(clearFlag)
    }
  }, [])
}

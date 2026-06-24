"use client"
import { useEffect, useState } from "react"
import { X } from "lucide-react"

const CONSENT_KEY = "cf_cookie_consent"

export type ConsentStatus = "accepted" | "declined" | null

export function getConsentStatus(): ConsentStatus {
  if (typeof window === "undefined") return null
  return (localStorage.getItem(CONSENT_KEY) as ConsentStatus) ?? null
}

export function CookieConsent() {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    if (!localStorage.getItem(CONSENT_KEY)) setVisible(true)
  }, [])

  function accept() {
    localStorage.setItem(CONSENT_KEY, "accepted")
    setVisible(false)
  }

  function decline() {
    localStorage.setItem(CONSENT_KEY, "declined")
    setVisible(false)
  }

  if (!visible) return null

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 p-4 md:p-6 pointer-events-none">
      <div className="max-w-2xl mx-auto bg-white border border-slate-200 rounded-xl shadow-lg p-4 md:p-5 pointer-events-auto">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1">
            <p className="text-sm text-slate-700 font-medium mb-1">This site uses cookies</p>
            <p className="text-xs text-slate-500 leading-relaxed">
              We use essential cookies to keep your shopping cart working across page visits.
              No tracking or advertising cookies are used.{" "}
              <a href="/cookies" className="underline hover:text-slate-700">Cookie policy</a>
            </p>
          </div>
          <button onClick={decline} aria-label="Close" className="text-slate-400 hover:text-slate-600 flex-shrink-0 mt-0.5">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="flex gap-2 mt-3">
          <button onClick={accept}
            className="px-4 py-1.5 text-xs font-medium bg-brand text-white rounded-lg hover:bg-brand-hover transition-colors">
            Accept
          </button>
          <button onClick={decline}
            className="px-4 py-1.5 text-xs font-medium border border-slate-300 text-slate-600 rounded-lg hover:bg-slate-50 transition-colors">
            Essential only
          </button>
        </div>
      </div>
    </div>
  )
}

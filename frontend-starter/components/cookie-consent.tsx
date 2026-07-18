"use client"
import { useEffect, useState } from "react"
import { X } from "lucide-react"

const CONSENT_KEY = "cf_cookie_consent"
export const CONSENT_CHANGED_EVENT = "cf:consent-changed"

export type ConsentStatus = "accepted" | "declined" | null

export function getConsentStatus(): ConsentStatus {
  if (typeof window === "undefined") return null
  return (localStorage.getItem(CONSENT_KEY) as ConsentStatus) ?? null
}

interface Props {
  /** True when this deployment has a GA4/Meta Pixel ID configured — changes the disclosure copy. */
  analyticsEnabled?: boolean
}

export function CookieConsent({ analyticsEnabled = false }: Props) {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- correct mount-time localStorage read (SSR-safe banner reveal); proper refactor tracked in backlog "Storefront lint debt"
    if (!localStorage.getItem(CONSENT_KEY)) setVisible(true)
  }, [])

  function setStatus(status: Exclude<ConsentStatus, null>) {
    localStorage.setItem(CONSENT_KEY, status)
    window.dispatchEvent(new CustomEvent(CONSENT_CHANGED_EVENT, { detail: status }))
    setVisible(false)
  }

  function accept() { setStatus("accepted") }
  function decline() { setStatus("declined") }

  if (!visible) return null

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 p-4 md:p-6 pointer-events-none">
      <div className="max-w-2xl mx-auto bg-white border border-slate-200 rounded-xl shadow-lg p-4 md:p-5 pointer-events-auto">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1">
            <p className="text-sm text-slate-700 font-medium mb-1">This site uses cookies</p>
            <p className="text-xs text-slate-500 leading-relaxed">
              We use essential cookies to keep your shopping cart working across page visits.
              {analyticsEnabled
                ? " With your consent, we also use analytics cookies to understand site usage."
                : " No tracking or advertising cookies are used."}{" "}
              <a href="/cookies" className="underline hover:text-slate-700">Cookie policy</a>
            </p>
          </div>
          <button onClick={decline} aria-label="Close" className="text-slate-400 hover:text-slate-600 flex-shrink-0 mt-0.5">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="flex gap-2 mt-3">
          <button onClick={accept}
            className="px-4 py-1.5 text-xs font-medium bg-brand text-on-brand rounded-lg hover:bg-brand-hover transition-colors">
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

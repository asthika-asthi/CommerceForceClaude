"use client"
import { useState } from "react"
import { api } from "@/lib/api"
import { usePlugin } from "@/lib/plugins-context"

export function Newsletter() {
  const newsletterEnabled = usePlugin("newsletter")
  const [email, setEmail] = useState("")
  const [status, setStatus] = useState<"idle" | "loading" | "done" | "error">("idle")

  if (!newsletterEnabled) return null

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!email.trim()) return
    setStatus("loading")
    try {
      await api.post("/api/newsletter/subscribe", { email })
      setStatus("done")
    } catch {
      setStatus("error")
    }
  }

  return (
    <div className="py-[60px] px-10" style={{ background: "linear-gradient(135deg, var(--brand-dark) 0%, var(--dark-deep) 100%)" }}>
      <div className="max-w-[600px] mx-auto text-center">
        <h2 className="text-[28px] font-bold text-white mb-2">Stay ahead — trade offers &amp; new stock</h2>
        <p className="text-[15px] text-on-dark mb-7">
          Join 1,800+ decorators, builders, and site managers who get early access to promotions, new product lines, and price list updates.
        </p>

        {status === "done" ? (
          <p className="text-[#4CAF50] text-base font-semibold">✓ You&apos;re subscribed! We&apos;ll be in touch soon.</p>
        ) : (
          <form onSubmit={handleSubmit} className="flex gap-2.5">
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="Enter your email address"
              required
              className="flex-1 bg-white/10 border-[1.5px] border-white/20 focus:border-white/50 rounded-lg px-4 py-3.5 text-white text-[14px] outline-none transition-colors placeholder:text-white/45"
            />
            <button
              type="submit"
              disabled={status === "loading"}
              className="bg-brand hover:bg-brand-hover text-on-brand font-bold text-[14px] px-[22px] py-3.5 rounded-lg transition-colors whitespace-nowrap disabled:opacity-60"
            >
              {status === "loading" ? "Subscribing…" : "Subscribe"}
            </button>
          </form>
        )}

        {status === "error" && (
          <p className="text-brand-highlight text-[13px] mt-2">Something went wrong — please try again or email us directly.</p>
        )}

        <p className="text-[11px] text-white/40 mt-3">No spam. Unsubscribe any time. We never share your details.</p>
      </div>
    </div>
  )
}

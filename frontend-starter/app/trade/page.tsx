"use client"
import { useState } from "react"
import Link from "next/link"
import { api } from "@/lib/api"

const BUSINESS_TYPES = [
  { value: "", label: "Select business type" },
  { value: "decorator", label: "Decorator" },
  { value: "builder", label: "Builder / Contractor" },
  { value: "scaffolding", label: "Scaffolding" },
  { value: "groundworks", label: "Groundworks" },
  { value: "cleaning", label: "Cleaning company" },
  { value: "other", label: "Other" },
]

const inputCls =
  "w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-dark text-slate-800 placeholder:text-slate-400"

const BENEFITS = [
  {
    icon: "💷",
    title: "Trade pricing",
    desc: "Exclusive wholesale prices not shown to retail customers. Save more the more you buy.",
  },
  {
    icon: "📅",
    title: "30-day payment terms",
    desc: "Buy now, pay later. Approved trade accounts receive invoiced 30-day credit terms.",
  },
  {
    icon: "📦",
    title: "Bulk order discounts",
    desc: "Volume discounts available on all products. Perfect for large site requirements.",
  },
  {
    icon: "👤",
    title: "Dedicated account manager",
    desc: "A named contact for quotes, orders, and queries — no call centres.",
  },
]

export default function TradePage() {
  const [form, setForm] = useState({
    first_name: "", last_name: "", email: "", password: "",
    company_name: "", vat_number: "", business_type: "",
  })
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle")
  const [errorMsg, setErrorMsg] = useState("")

  function set(key: string) {
    return (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
      setForm((f) => ({ ...f, [key]: e.target.value }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setStatus("loading")
    setErrorMsg("")
    try {
      await api.post("/api/auth/register-trade", form)
      setStatus("success")
    } catch (err) {
      setStatus("error")
      setErrorMsg(err instanceof Error ? err.message : "Registration failed. Please try again.")
    }
  }

  return (
    <div className="max-w-[1100px] mx-auto px-6 py-14">
      {/* Hero */}
      <div className="text-center mb-14">
        <h1 className="text-[36px] font-bold text-brand-dark mb-3">Trade accounts</h1>
        <p className="text-[16px] text-slate-500 max-w-xl mx-auto">
          Join hundreds of decorators, builders, and contractors who trust Tri Star UK Ltd for
          their protective materials. Apply for a free trade account today.
        </p>
      </div>

      {/* Benefits grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 mb-16">
        {BENEFITS.map(({ icon, title, desc }) => (
          <div key={title} className="bg-white border border-[#E0DED8] rounded-2xl p-6">
            <div className="text-3xl mb-3">{icon}</div>
            <h3 className="text-[15px] font-bold text-brand-dark mb-1">{title}</h3>
            <p className="text-[13px] text-slate-500 leading-[1.6]">{desc}</p>
          </div>
        ))}
      </div>

      {/* Registration form */}
      <div className="max-w-xl mx-auto">
        <div className="bg-white border border-[#E0DED8] rounded-2xl p-8">
          <h2 className="text-[22px] font-bold text-brand-dark mb-1">Apply for a trade account</h2>
          <p className="text-[13px] text-slate-400 mb-6">
            We review all applications within 1–2 business days and email you once approved.
          </p>

          {status === "success" ? (
            <div className="text-center py-6">
              <div className="w-14 h-14 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="2.5">
                  <path d="M20 6L9 17l-5-5"/>
                </svg>
              </div>
              <h3 className="text-[18px] font-bold text-brand-dark mb-2">Application received</h3>
              <p className="text-[14px] text-slate-500">
                Thank you! We&apos;ll review your application and email you at{" "}
                <strong>{form.email}</strong> within 1–2 business days.
              </p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              {status === "error" && (
                <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-3 py-2">
                  {errorMsg}
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[13px] font-semibold text-slate-600 mb-1">First name *</label>
                  <input required value={form.first_name} onChange={set("first_name")} className={inputCls} />
                </div>
                <div>
                  <label className="block text-[13px] font-semibold text-slate-600 mb-1">Last name</label>
                  <input value={form.last_name} onChange={set("last_name")} className={inputCls} />
                </div>
              </div>

              <div>
                <label className="block text-[13px] font-semibold text-slate-600 mb-1">Email address *</label>
                <input type="email" required value={form.email} onChange={set("email")} className={inputCls} />
              </div>

              <div>
                <label className="block text-[13px] font-semibold text-slate-600 mb-1">Password *</label>
                <input type="password" required minLength={8} value={form.password} onChange={set("password")}
                  placeholder="Min. 8 characters"
                  className={inputCls} />
              </div>

              <div>
                <label className="block text-[13px] font-semibold text-slate-600 mb-1">Company name *</label>
                <input required value={form.company_name} onChange={set("company_name")} className={inputCls} />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[13px] font-semibold text-slate-600 mb-1">VAT number</label>
                  <input value={form.vat_number} onChange={set("vat_number")} placeholder="GB 000 0000 00" className={inputCls} />
                </div>
                <div>
                  <label className="block text-[13px] font-semibold text-slate-600 mb-1">Business type</label>
                  <select value={form.business_type} onChange={set("business_type")} className={inputCls}>
                    {BUSINESS_TYPES.map(o => (
                      <option key={o.value} value={o.value}>{o.label}</option>
                    ))}
                  </select>
                </div>
              </div>

              <button
                type="submit"
                disabled={status === "loading"}
                className="w-full bg-brand hover:bg-brand-hover text-white font-semibold py-3 rounded-xl transition-colors disabled:opacity-50 text-[15px] mt-2"
              >
                {status === "loading" ? "Submitting…" : "Apply for trade account"}
              </button>

              <p className="text-[12px] text-slate-400 text-center">
                Already have an account?{" "}
                <Link href="/login" className="text-brand-dark hover:underline">Sign in</Link>
              </p>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}

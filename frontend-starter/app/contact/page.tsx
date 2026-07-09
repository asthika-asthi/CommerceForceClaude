"use client"
import { useState } from "react"
import { api } from "@/lib/api"

const SUBJECTS = [
  "General enquiry",
  "Trade account",
  "Bulk order",
  "Delivery",
  "Returns",
  "Other",
]

const inputCls =
  "w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-dark text-slate-800 placeholder:text-slate-400"

export default function ContactPage() {
  const [form, setForm] = useState({
    name: "", email: "", phone: "", subject: SUBJECTS[0], message: "",
  })
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle")
  const [errorMsg, setErrorMsg] = useState("")

  function set(key: string) {
    return (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
      setForm((f) => ({ ...f, [key]: e.target.value }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setStatus("loading")
    setErrorMsg("")
    try {
      await api.post("/api/contact", { ...form, enquiry_type: "general" })
      setStatus("success")
    } catch (err) {
      setStatus("error")
      setErrorMsg(err instanceof Error ? err.message : "Something went wrong. Please try again.")
    }
  }

  if (status === "success") {
    return (
      <div className="min-h-[50vh] flex items-center justify-center px-4">
        <div className="text-center max-w-md">
          <div className="w-14 h-14 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-5">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="2.5">
              <path d="M20 6L9 17l-5-5"/>
            </svg>
          </div>
          <h2 className="text-2xl font-bold text-brand-dark mb-2">Message sent</h2>
          <p className="text-slate-500 text-[15px]">
            Thank you for getting in touch. We aim to respond within 1 business day.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-[1100px] mx-auto px-6 py-14">
      <h1 className="text-[32px] font-bold text-brand-dark mb-2">Contact us</h1>
      <p className="text-[15px] text-slate-500 mb-10">
        Have a question or want to place a large order? We&apos;d love to hear from you.
      </p>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-10">
        {/* Contact details */}
        <div className="lg:col-span-2 space-y-6">
          {[
            {
              icon: (
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                  <path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07A19.5 19.5 0 013.5 10.81a19.79 19.79 0 01-3.07-8.64A2 2 0 012.41 0h3a2 2 0 012 1.72 12.84 12.84 0 00.7 2.81 2 2 0 01-.45 2.11L6.91 7.91a16 16 0 006.18 6.18l.77-.77a2 2 0 012.11-.45 12.84 12.84 0 002.81.7A2 2 0 0122 16.92z"/>
                </svg>
              ),
              label: "Phone", value: "01438 880 178",
            },
            {
              icon: (
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                  <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/>
                  <polyline points="22,6 12,13 2,6"/>
                </svg>
              ),
              label: "Email", value: "info@tristarukltd.co.uk",
            },
            {
              icon: (
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                  <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z"/>
                  <circle cx="12" cy="10" r="3"/>
                </svg>
              ),
              label: "Address", value: "Stevenage, Hertfordshire",
            },
            {
              icon: (
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                  <circle cx="12" cy="12" r="10"/>
                  <polyline points="12 6 12 12 16 14"/>
                </svg>
              ),
              label: "Hours", value: "Mon–Fri  8:30 am – 5:00 pm",
            },
          ].map(({ icon, label, value }) => (
            <div key={label} className="flex items-start gap-4">
              <div className="w-10 h-10 bg-brand/10 rounded-xl flex items-center justify-center text-brand-dark flex-shrink-0">
                {icon}
              </div>
              <div>
                <p className="text-[12px] font-semibold text-slate-400 uppercase tracking-wide mb-0.5">{label}</p>
                <p className="text-[15px] text-brand-dark font-medium">{value}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Form */}
        <div className="lg:col-span-3 bg-white border border-border rounded-2xl p-8">
          <form onSubmit={handleSubmit} className="space-y-5">
            {status === "error" && (
              <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-3 py-2">
                {errorMsg}
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-[13px] font-semibold text-slate-600 mb-1">Full name *</label>
                <input required value={form.name} onChange={set("name")} placeholder="Jane Smith" className={inputCls} />
              </div>
              <div>
                <label className="block text-[13px] font-semibold text-slate-600 mb-1">Phone</label>
                <input type="tel" value={form.phone} onChange={set("phone")} placeholder="07700 000 000" className={inputCls} />
              </div>
            </div>

            <div>
              <label className="block text-[13px] font-semibold text-slate-600 mb-1">Email address *</label>
              <input type="email" required value={form.email} onChange={set("email")} placeholder="jane@example.com" className={inputCls} />
            </div>

            <div>
              <label className="block text-[13px] font-semibold text-slate-600 mb-1">Subject</label>
              <select value={form.subject} onChange={set("subject")} className={inputCls}>
                {SUBJECTS.map(s => <option key={s}>{s}</option>)}
              </select>
            </div>

            <div>
              <label className="block text-[13px] font-semibold text-slate-600 mb-1">Message *</label>
              <textarea
                required rows={5} value={form.message} onChange={set("message")}
                placeholder="Tell us how we can help…"
                className={`${inputCls} resize-none`}
              />
            </div>

            <button
              type="submit"
              disabled={status === "loading"}
              className="w-full bg-brand hover:bg-brand-hover text-on-brand font-semibold py-3 rounded-xl transition-colors disabled:opacity-50 text-[15px]"
            >
              {status === "loading" ? "Sending…" : "Send message"}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}

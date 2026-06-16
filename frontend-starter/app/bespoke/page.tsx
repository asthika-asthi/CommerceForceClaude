"use client"
import { useState } from "react"
import { api } from "@/lib/api"

const MATERIAL_TYPES = [
  "Polythene / PE",
  "Canvas / cotton",
  "PVC coated polyester",
  "Woven PP (tonne bags / rubble sacks)",
  "Non-woven",
  "Not sure — advise me",
]

const inputCls =
  "w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-dark text-slate-800 placeholder:text-slate-400"

export default function BespokePage() {
  const [form, setForm] = useState({
    name: "", email: "", phone: "", company: "",
    message: "", material_type: "", quantity_description: "",
    size_spec: "", deadline: "",
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
      await api.post("/api/contact/bespoke", { ...form, enquiry_type: "bespoke" })
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
          <h2 className="text-2xl font-bold text-brand-dark mb-2">Enquiry received</h2>
          <p className="text-slate-500 text-[15px]">
            Thank you! A member of our team will be in touch within 1–2 business days
            with pricing and availability.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-[860px] mx-auto px-6 py-14">
      {/* Header */}
      <div className="mb-10">
        <h1 className="text-[32px] font-bold text-brand-dark mb-3">Bespoke enquiry</h1>
        <p className="text-[15px] text-slate-500 leading-[1.7]">
          Can&apos;t find the size, colour, or material you need? We manufacture and source
          bespoke protective products to your exact specification — from single-site orders
          to pallet quantities. Fill in the form below and we&apos;ll come back to you with
          pricing and lead times.
        </p>
      </div>

      <div className="bg-white border border-[#E0DED8] rounded-2xl p-8">
        <form onSubmit={handleSubmit} className="space-y-5">
          {status === "error" && (
            <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-3 py-2">
              {errorMsg}
            </div>
          )}

          {/* Contact details */}
          <div>
            <h3 className="text-[14px] font-bold text-brand-dark uppercase tracking-wide mb-3">
              Your details
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-[13px] font-semibold text-slate-600 mb-1">Full name *</label>
                <input required value={form.name} onChange={set("name")} className={inputCls} />
              </div>
              <div>
                <label className="block text-[13px] font-semibold text-slate-600 mb-1">Email address *</label>
                <input type="email" required value={form.email} onChange={set("email")} className={inputCls} />
              </div>
              <div>
                <label className="block text-[13px] font-semibold text-slate-600 mb-1">Phone</label>
                <input type="tel" value={form.phone} onChange={set("phone")} placeholder="07700 000 000" className={inputCls} />
              </div>
              <div>
                <label className="block text-[13px] font-semibold text-slate-600 mb-1">Company</label>
                <input value={form.company} onChange={set("company")} className={inputCls} />
              </div>
            </div>
          </div>

          <div className="border-t border-[#E0DED8] pt-5">
            <h3 className="text-[14px] font-bold text-brand-dark uppercase tracking-wide mb-3">
              Product specification
            </h3>
            <div className="space-y-4">
              <div>
                <label className="block text-[13px] font-semibold text-slate-600 mb-1">
                  What do you need? *
                </label>
                <textarea
                  required rows={3} value={form.message} onChange={set("message")}
                  placeholder="Describe the product, intended use, and any specific requirements…"
                  className={`${inputCls} resize-none`}
                />
              </div>

              <div>
                <label className="block text-[13px] font-semibold text-slate-600 mb-1">
                  Preferred material
                </label>
                <select value={form.material_type} onChange={set("material_type")} className={inputCls}>
                  <option value="">Select material (optional)</option>
                  {MATERIAL_TYPES.map(m => <option key={m} value={m}>{m}</option>)}
                </select>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[13px] font-semibold text-slate-600 mb-1">
                    Size / dimensions
                  </label>
                  <input
                    value={form.size_spec} onChange={set("size_spec")}
                    placeholder="e.g. 3m × 4m, 120gsm"
                    className={inputCls}
                  />
                </div>
                <div>
                  <label className="block text-[13px] font-semibold text-slate-600 mb-1">
                    Approximate quantity
                  </label>
                  <input
                    value={form.quantity_description} onChange={set("quantity_description")}
                    placeholder="e.g. 500 units, 2 pallets"
                    className={inputCls}
                  />
                </div>
              </div>

              <div>
                <label className="block text-[13px] font-semibold text-slate-600 mb-1">
                  Required by (date or timeframe)
                </label>
                <input
                  value={form.deadline} onChange={set("deadline")}
                  placeholder="e.g. end of July, ASAP, flexible"
                  className={inputCls}
                />
              </div>
            </div>
          </div>

          <button
            type="submit"
            disabled={status === "loading"}
            className="w-full bg-brand hover:bg-brand-hover text-white font-semibold py-3 rounded-xl transition-colors disabled:opacity-50 text-[15px]"
          >
            {status === "loading" ? "Sending enquiry…" : "Submit bespoke enquiry"}
          </button>
        </form>
      </div>
    </div>
  )
}

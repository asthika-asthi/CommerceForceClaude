"use client"
import { useState } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { api } from "@/lib/api"
import type { LoyaltyConfig } from "@/lib/types"
import { PageHeader } from "@/components/page-header"

export default function LoyaltyPage() {
  const qc = useQueryClient()
  const { data: config, isLoading } = useQuery<LoyaltyConfig>({
    queryKey: ["loyalty-config"],
    queryFn: () => api.get("/api/loyalty/config"),
  })
  const [form, setForm] = useState({ points_per_dollar: "", redemption_rate: "", min_redemption: "", is_active: true })
  const [saved, setSaved] = useState(false)

  const update = useMutation({
    mutationFn: (d: typeof form) =>
      api.put("/api/loyalty/config", {
        points_per_dollar: d.points_per_dollar || undefined,
        redemption_rate: d.redemption_rate || undefined,
        min_redemption: d.min_redemption ? Number(d.min_redemption) : undefined,
        is_active: d.is_active,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["loyalty-config"] })
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    },
  })

  if (isLoading || !config) {
    return <div className="flex justify-center py-12"><div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" /></div>
  }

  return (
    <div className="max-w-xl">
      <PageHeader title="Loyalty Program" description="Configure points earn and redemption rates" />

      {/* Current config display */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        {[
          { label: "Points per £1", value: config.points_per_dollar },
          { label: "Redemption Rate", value: `£${config.redemption_rate}/pt` },
          { label: "Min Redemption", value: `${config.min_redemption} pts` },
        ].map(({ label, value }) => (
          <div key={label} className="bg-white rounded-xl border border-slate-200 p-4">
            <p className="text-xs text-slate-500">{label}</p>
            <p className="text-xl font-bold text-slate-900 mt-1">{value}</p>
          </div>
        ))}
      </div>

      {/* Update form */}
      <form onSubmit={(e) => { e.preventDefault(); update.mutate(form) }}
        className="bg-white rounded-xl border border-slate-200 p-5 space-y-4">
        <h3 className="text-sm font-semibold text-slate-700">Update Configuration</h3>
        {[
          { key: "points_per_dollar", label: "Points per £1 spent", placeholder: config.points_per_dollar },
          { key: "redemption_rate", label: "Redemption Rate (£ per point)", placeholder: config.redemption_rate },
          { key: "min_redemption", label: "Minimum Points to Redeem", placeholder: String(config.min_redemption) },
        ].map(({ key, label, placeholder }) => (
          <div key={key}>
            <label className="block text-sm font-medium text-slate-700 mb-1">{label}</label>
            <input
              type="number" step="0.001"
              value={(form as Record<string, string | boolean>)[key] as string}
              onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
              placeholder={placeholder}
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        ))}
        <label className="flex items-center gap-2 text-sm text-slate-700">
          <input type="checkbox" checked={form.is_active}
            onChange={(e) => setForm((f) => ({ ...f, is_active: e.target.checked }))} />
          Program Active
        </label>
        <button type="submit" disabled={update.isPending}
          className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-2 rounded-lg text-sm font-medium disabled:opacity-50">
          {update.isPending ? "Saving…" : saved ? "Saved!" : "Save Changes"}
        </button>
      </form>
    </div>
  )
}

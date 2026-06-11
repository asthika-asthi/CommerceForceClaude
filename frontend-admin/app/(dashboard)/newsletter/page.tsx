"use client"
import { useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { api } from "@/lib/api"
import type { Subscriber } from "@/lib/types"
import { PageHeader } from "@/components/page-header"
import { StatusBadge } from "@/components/status-badge"

export default function NewsletterPage() {
  const [activeOnly, setActiveOnly] = useState(true)
  const { data: subscribers = [], isLoading } = useQuery<Subscriber[]>({
    queryKey: ["subscribers", activeOnly],
    queryFn: () => api.get(`/api/newsletter/subscribers?active_only=${activeOnly}`),
  })
  const { data: stats } = useQuery<{ active_subscribers: number }>({
    queryKey: ["newsletter-stats"],
    queryFn: () => api.get("/api/newsletter/stats"),
  })

  return (
    <div>
      <PageHeader
        title="Newsletter"
        description={stats ? `${stats.active_subscribers} active subscribers` : undefined}
      />

      <div className="flex items-center gap-4 mb-4">
        <label className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer">
          <input type="checkbox" checked={activeOnly}
            onChange={(e) => setActiveOnly(e.target.checked)} />
          Active only
        </label>
        <span className="text-sm text-slate-500">{subscribers.length} shown</span>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12"><div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" /></div>
      ) : (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-slate-600">Email</th>
                <th className="text-left px-4 py-3 font-medium text-slate-600">Name</th>
                <th className="text-left px-4 py-3 font-medium text-slate-600">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {subscribers.length === 0 && (
                <tr><td colSpan={3} className="text-center py-10 text-slate-400">No subscribers</td></tr>
              )}
              {subscribers.map((s) => (
                <tr key={s.id} className="hover:bg-slate-50">
                  <td className="px-4 py-2.5 text-slate-800">{s.email}</td>
                  <td className="px-4 py-2.5 text-slate-600">{s.first_name ?? "—"}</td>
                  <td className="px-4 py-2.5"><StatusBadge value={s.is_active ? "active" : "inactive"} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

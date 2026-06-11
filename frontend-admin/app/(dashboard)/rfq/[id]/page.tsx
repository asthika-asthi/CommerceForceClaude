"use client"
import { useState, useEffect, useRef } from "react"
import { useParams, useRouter } from "next/navigation"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import Link from "next/link"
import { api } from "@/lib/api"
import { PageHeader } from "@/components/page-header"
import { StatusBadge } from "@/components/status-badge"
import { ArrowLeft } from "lucide-react"

import type { RFQ } from "@/lib/types"

export default function RFQDetailPage() {
  const { id } = useParams() as { id: string }
  const router = useRouter()
  const qc = useQueryClient()

  const { data: rfq, isLoading } = useQuery<RFQ>({
    queryKey: ["rfq", id],
    queryFn: () => api.get(`/api/rfq/${id}`),
  })

  const [prices, setPrices] = useState<Record<string, string>>({})
  const [adminNotes, setAdminNotes] = useState("")
  const [validUntil, setValidUntil] = useState("")

  const initialized = useRef(false)
  useEffect(() => {
    if (rfq && !initialized.current) {
      initialized.current = true
      const init: Record<string, string> = {}
      rfq.items.forEach((item) => { init[item.id] = item.quoted_price ?? "" })
      setPrices(init)
      setAdminNotes(rfq.admin_notes ?? "")
    }
  }, [rfq])

  const review = useMutation({
    mutationFn: () => api.post(`/api/rfq/${id}/review`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["rfq", id] })
      qc.invalidateQueries({ queryKey: ["rfqs"] })
    },
  })
  const reject = useMutation({
    mutationFn: () => api.post(`/api/rfq/${id}/reject`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["rfqs"] }); router.push("/rfq") },
  })
  const quote = useMutation({
    mutationFn: () => api.post(`/api/rfq/${id}/quote`, {
      admin_notes: adminNotes || undefined,
      valid_until: validUntil || undefined,
      item_quotes: rfq!.items.map((item) => ({ rfq_item_id: item.id, quoted_price: parseFloat(prices[item.id] || "0") })),
    }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["rfq", id] }),
  })

  if (isLoading || !rfq) return <div className="flex justify-center py-20 text-slate-400">Loading…</div>

  const canReview = rfq.status === "submitted"
  const canQuote = rfq.status === "under_review"
  const canReject = rfq.status === "submitted" || rfq.status === "under_review"

  return (
    <div className="max-w-3xl">
      <Link href="/rfq" className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-800 mb-4">
        <ArrowLeft size={14} /> Back to RFQs
      </Link>
      <PageHeader
        title={`RFQ ${rfq.rfq_number}`}
        description={`Customer: ${rfq.user_id.slice(0, 12)}… · Created ${new Date(rfq.created_at).toLocaleDateString()}`}
      />

      <div className="flex items-center gap-3 mb-6">
        <StatusBadge value={rfq.status} />
        {canReview && (
          <button onClick={() => review.mutate()} disabled={review.isPending}
            className="text-sm bg-indigo-600 text-white px-3 py-1.5 rounded-lg hover:bg-indigo-700 disabled:opacity-50">
            {review.isPending ? "Marking…" : "Mark Under Review"}
          </button>
        )}
        {canReject && (
          <button onClick={() => reject.mutate()} disabled={reject.isPending}
            className="text-sm bg-red-600 text-white px-3 py-1.5 rounded-lg hover:bg-red-700 disabled:opacity-50">
            {reject.isPending ? "Rejecting…" : "Reject"}
          </button>
        )}
      </div>

      {rfq.notes && (
        <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 mb-6">
          <p className="text-xs font-medium text-slate-500 mb-1">Customer Notes</p>
          <p className="text-sm text-slate-700">{rfq.notes}</p>
        </div>
      )}

      {/* Items table */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden mb-6">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 border-b border-slate-200">
            <tr>
              {["Product", "SKU", "Qty Requested", "Quoted Price"].map((h) => (
                <th key={h} className="text-left px-4 py-3 font-medium text-slate-600">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rfq.items.map((item) => (
              <tr key={item.id}>
                <td className="px-4 py-2.5 text-slate-800">{item.product_name ?? "—"}</td>
                <td className="px-4 py-2.5 font-mono text-xs text-slate-500">{item.product_sku ?? "—"}</td>
                <td className="px-4 py-2.5 text-slate-700">{item.requested_quantity}</td>
                <td className="px-4 py-2.5">
                  {canQuote ? (
                    <input
                      type="number" step="0.01" min="0"
                      value={prices[item.id] ?? ""}
                      onChange={(e) => setPrices((p) => ({ ...p, [item.id]: e.target.value }))}
                      placeholder="0.00"
                      className="w-28 border border-slate-300 rounded-lg px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  ) : (
                    <span className={item.quoted_price ? "font-medium text-green-700" : "text-slate-400"}>
                      {item.quoted_price ? `$${parseFloat(item.quoted_price).toFixed(2)}` : "—"}
                    </span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Quote form */}
      {canQuote && (
        <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-4">
          <h3 className="font-semibold text-slate-800 text-sm">Send Quote</h3>
          <div>
            <label className="block text-sm text-slate-600 mb-1">Admin Notes (optional)</label>
            <textarea value={adminNotes} onChange={(e) => setAdminNotes(e.target.value)} rows={2}
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div>
            <label className="block text-sm text-slate-600 mb-1">Valid Until (optional)</label>
            <input type="date" value={validUntil} onChange={(e) => setValidUntil(e.target.value)}
              className="border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <button onClick={() => quote.mutate()} disabled={quote.isPending || rfq.items.some((item) => !parseFloat(prices[item.id] || "0"))}
            className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-2 rounded-lg text-sm font-medium disabled:opacity-50">
            {quote.isPending ? "Sending…" : "Send Quote"}
          </button>
          {quote.isSuccess && <p className="text-sm text-green-600">Quote sent successfully!</p>}
          {quote.isError && <p className="text-sm text-red-600">{(quote.error as Error).message}</p>}
        </div>
      )}
    </div>
  )
}

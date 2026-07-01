"use client"
import { useState } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import Link from "next/link"
import { api } from "@/lib/api"
import { PageHeader } from "@/components/page-header"
import { StatusBadge } from "@/components/status-badge"
import { Pagination } from "@/components/ui/pagination"

import type { RFQ, PaginatedRFQs } from "@/lib/types"

export default function RFQPage() {
  const qc = useQueryClient()
  const [page, setPage] = useState(1)
  const { data, isLoading } = useQuery<PaginatedRFQs>({
    queryKey: ["rfqs", page],
    queryFn: () => api.get(`/api/rfq?page=${page}&page_size=20`),
  })
  const rfqs = data?.items ?? []
  const totalPages = data ? Math.ceil(data.total / 20) : 1

  const review = useMutation({
    mutationFn: (id: string) => api.post(`/api/rfq/${id}/review`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["rfqs"] }),
  })
  const reject = useMutation({
    mutationFn: (id: string) => api.post(`/api/rfq/${id}/reject`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["rfqs"] }),
  })

  return (
    <div>
      <PageHeader title="Requests for Quote" description={data ? `${data.total} total` : undefined} />
      {isLoading ? (
        <div className="flex justify-center py-12"><div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" /></div>
      ) : (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                {["RFQ #", "Customer", "Items", "Status", "Date", "Actions"].map((h) => (
                  <th key={h} className="text-left px-4 py-3 font-medium text-slate-600">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rfqs.length === 0 && (
                <tr><td colSpan={6} className="text-center py-10 text-slate-400">No RFQs</td></tr>
              )}
              {rfqs.map((r) => (
                <tr key={r.id} className="hover:bg-slate-50">
                  <td className="px-4 py-2.5 font-mono text-xs text-blue-600">
                    <Link href={`/rfq/${r.id}`} className="hover:underline">{r.rfq_number}</Link>
                  </td>
                  <td className="px-4 py-2.5 text-slate-600 text-xs">{r.user_id.slice(0, 8)}…</td>
                  <td className="px-4 py-2.5 text-slate-700">{r.items.length}</td>
                  <td className="px-4 py-2.5"><StatusBadge value={r.status} /></td>
                  <td className="px-4 py-2.5 text-slate-500 text-xs">{new Date(r.created_at).toLocaleDateString()}</td>
                  <td className="px-4 py-2.5">
                    <div className="flex gap-2 items-center">
                      <Link href={`/rfq/${r.id}`} className="text-xs text-blue-500 hover:text-blue-700">View</Link>
                      {r.status === "submitted" && (
                        <button onClick={() => review.mutate(r.id)} disabled={review.isPending} className="text-xs text-indigo-500 hover:text-indigo-700 disabled:opacity-50">
                          Review
                        </button>
                      )}
                      {(r.status === "submitted" || r.status === "under_review") && (
                        <button onClick={() => reject.mutate(r.id)} disabled={reject.isPending} className="text-xs text-red-500 hover:text-red-700 disabled:opacity-50">
                          Reject
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <Pagination
        page={page}
        totalPages={totalPages}
        onPrev={() => setPage(p => p - 1)}
        onNext={() => setPage(p => p + 1)}
      />
    </div>
  )
}

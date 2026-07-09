"use client"
import { useState } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { api } from "@/lib/api"
import { PageHeader } from "@/components/page-header"
import { StatusBadge } from "@/components/status-badge"
import { Pagination } from "@/components/ui/pagination"
import type { PaginatedDeletionRequests } from "@/lib/types"

export default function DeletionRequestsPage() {
  const qc = useQueryClient()
  const [page, setPage] = useState(1)
  const [rejectingId, setRejectingId] = useState<string | null>(null)
  const [rejectNotes, setRejectNotes] = useState("")

  const { data, isLoading } = useQuery<PaginatedDeletionRequests>({
    queryKey: ["deletion-requests", page],
    queryFn: () => api.get(`/api/auth/deletion-requests?page=${page}&page_size=20`),
  })
  const requests = data?.items ?? []
  const totalPages = data ? Math.ceil(data.total / 20) : 1

  const approve = useMutation({
    mutationFn: (id: string) => api.post(`/api/auth/deletion-requests/${id}/approve`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["deletion-requests"] }),
  })
  const reject = useMutation({
    mutationFn: ({ id, admin_notes }: { id: string; admin_notes: string }) =>
      api.post(`/api/auth/deletion-requests/${id}/reject`, { admin_notes }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["deletion-requests"] })
      setRejectingId(null)
      setRejectNotes("")
    },
  })

  return (
    <div>
      <PageHeader
        title="Data Deletion Requests"
        description="GDPR account-deletion requests — approving scrubs the account's personal data immediately. Orders and other financial records are retained but stripped of personal details."
      />
      {isLoading ? (
        <div className="flex justify-center py-12"><div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" /></div>
      ) : (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                {["Email", "Status", "Requested", "Notes", "Actions"].map((h) => (
                  <th key={h} className="text-left px-4 py-3 font-medium text-slate-600">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {requests.length === 0 && (
                <tr><td colSpan={5} className="text-center py-10 text-slate-400">No deletion requests</td></tr>
              )}
              {requests.map((r) => (
                <tr key={r.id} className="hover:bg-slate-50">
                  <td className="px-4 py-2.5 text-slate-700">{r.user_email_snapshot}</td>
                  <td className="px-4 py-2.5"><StatusBadge value={r.status} /></td>
                  <td className="px-4 py-2.5 text-slate-500 text-xs">{new Date(r.created_at).toLocaleDateString()}</td>
                  <td className="px-4 py-2.5 text-slate-500 text-xs max-w-[220px] truncate">{r.admin_notes ?? "—"}</td>
                  <td className="px-4 py-2.5">
                    {r.status === "pending" ? (
                      rejectingId === r.id ? (
                        <div className="flex items-center gap-2">
                          <input value={rejectNotes} onChange={(e) => setRejectNotes(e.target.value)}
                            placeholder="Reason (required)"
                            className="border border-slate-300 rounded px-2 py-1 text-xs w-40" />
                          <button
                            onClick={() => reject.mutate({ id: r.id, admin_notes: rejectNotes })}
                            disabled={reject.isPending || !rejectNotes.trim()}
                            className="text-xs text-red-600 hover:text-red-800 disabled:opacity-50">
                            Confirm
                          </button>
                          <button onClick={() => { setRejectingId(null); setRejectNotes("") }} className="text-xs text-slate-400 hover:text-slate-600">
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <div className="flex gap-3 items-center">
                          <button onClick={() => approve.mutate(r.id)} disabled={approve.isPending}
                            className="text-xs text-green-600 hover:text-green-800 disabled:opacity-50 font-medium">
                            Approve &amp; Anonymize
                          </button>
                          <button onClick={() => setRejectingId(r.id)} className="text-xs text-red-500 hover:text-red-700">
                            Reject
                          </button>
                        </div>
                      )
                    ) : (
                      <span className="text-xs text-slate-400">
                        {r.reviewed_at ? `Reviewed ${new Date(r.reviewed_at).toLocaleDateString()}` : "—"}
                      </span>
                    )}
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

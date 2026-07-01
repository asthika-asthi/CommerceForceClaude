"use client"
import { useState } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { api } from "@/lib/api"
import { PageHeader } from "@/components/page-header"
import { StatusBadge } from "@/components/status-badge"
import { Pagination } from "@/components/ui/pagination"
import type { User, Paginated } from "@/lib/types"

function downloadCsv(path: string, filename: string) {
  const token = localStorage.getItem("cf_access_token")
  const base = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000"
  fetch(`${base}${path}`, { headers: { Authorization: `Bearer ${token}` } })
    .then(r => r.blob())
    .then(blob => {
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url; a.download = filename; a.click()
      URL.revokeObjectURL(url)
    })
}

const TRADE_STATUS_STYLES: Record<string, string> = {
  pending: "bg-yellow-100 text-yellow-700",
  approved: "bg-green-100 text-green-700",
  rejected: "bg-red-100 text-red-600",
}

export default function UsersPage() {
  const qc = useQueryClient()
  const [page, setPage] = useState(1)

  const { data, isLoading } = useQuery<Paginated<User>>({
    queryKey: ["users", page],
    queryFn: () => api.get(`/api/auth/users?page=${page}&page_size=20`),
  })
  const users = data?.items ?? []
  const totalPages = data ? data.pages : 1

  const patch = useMutation({
    mutationFn: ({ id, body }: { id: string; body: { is_active?: boolean; role?: string; trade_status?: string } }) =>
      api.patch<User>(`/api/auth/users/${id}`, body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["users"] }),
  })

  if (isLoading && !data) {
    return (
      <div>
        <PageHeader title="Users" description="Manage customer and staff accounts" />
        <div className="flex justify-center py-20">
          <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
        </div>
      </div>
    )
  }

  const tradeApplicants = users.filter((u) => u.trade_status != null)

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Users</h1>
          <p className="text-sm text-slate-500 mt-0.5">{data?.total ?? users.length} accounts</p>
        </div>
        <button
          onClick={() => downloadCsv("/api/auth/customers/export/csv", "customers.csv")}
          className="px-4 py-2 rounded-lg text-sm font-medium border border-slate-300 text-slate-600 hover:bg-slate-50 transition-colors"
        >
          Export CSV
        </button>
      </div>

      {/* Trade applications section */}
      {tradeApplicants.length > 0 && (
        <div>
          <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-3">
            Trade applications ({tradeApplicants.filter((u) => u.trade_status === "pending").length} pending)
          </h2>
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  {["Name", "Email", "Company", "VAT", "Type", "Trade status", "Actions"].map((h) => (
                    <th key={h} className="text-left px-4 py-3 text-xs font-medium text-slate-500">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {tradeApplicants.map((u) => (
                  <tr key={u.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3 font-medium text-slate-800">{u.first_name} {u.last_name}</td>
                    <td className="px-4 py-3 text-slate-600">{u.email}</td>
                    <td className="px-4 py-3 text-slate-500 text-xs">{u.company_name ?? "—"}</td>
                    <td className="px-4 py-3 text-slate-500 text-xs">{u.vat_number ?? "—"}</td>
                    <td className="px-4 py-3 text-slate-500 text-xs">{u.business_type ?? "—"}</td>
                    <td className="px-4 py-3">
                      {u.trade_status && (
                        <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${TRADE_STATUS_STYLES[u.trade_status] ?? "bg-slate-100 text-slate-500"}`}>
                          {u.trade_status}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {u.trade_status === "pending" && (
                        <div className="flex gap-2">
                          <button
                            onClick={() => patch.mutate({ id: u.id, body: { trade_status: "approved" } })}
                            disabled={patch.isPending}
                            className="text-xs px-2.5 py-1 rounded-lg bg-green-50 text-green-700 hover:bg-green-100 font-medium disabled:opacity-50"
                          >
                            Approve
                          </button>
                          <button
                            onClick={() => patch.mutate({ id: u.id, body: { trade_status: "rejected" } })}
                            disabled={patch.isPending}
                            className="text-xs px-2.5 py-1 rounded-lg bg-red-50 text-red-600 hover:bg-red-100 font-medium disabled:opacity-50"
                          >
                            Reject
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* All users */}
      <div>
        {tradeApplicants.length > 0 && (
          <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-3">All accounts</h2>
        )}
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-50">
              <tr>
                {["Name", "Email", "Role", "Status", "Actions"].map((h) => (
                  <th key={h} className="text-left px-4 py-3 text-xs font-medium text-slate-500">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {users.length === 0 && (
                <tr><td colSpan={5} className="text-center py-10 text-slate-400">No users found</td></tr>
              )}
              {users.map((u) => (
                <tr key={u.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3 font-medium text-slate-800">
                    {u.first_name} {u.last_name}
                    {u.company_name && <span className="ml-1 text-xs text-slate-400">({u.company_name})</span>}
                    {u.trade_status === "approved" && (
                      <span className="ml-1.5 text-[10px] font-bold px-1.5 py-0.5 rounded bg-green-100 text-green-700">TRADE</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-slate-600">{u.email}</td>
                  <td className="px-4 py-3">
                    <select
                      value={u.role}
                      onChange={(e) => patch.mutate({ id: u.id, body: { role: e.target.value } })}
                      className="border border-slate-200 rounded px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="customer">customer</option>
                      <option value="admin">admin</option>
                      <option value="superadmin">superadmin</option>
                    </select>
                  </td>
                  <td className="px-4 py-3"><StatusBadge value={u.is_active ? "active" : "inactive"} /></td>
                  <td className="px-4 py-3">
                    <button
                      onClick={() => patch.mutate({ id: u.id, body: { is_active: !u.is_active } })}
                      disabled={patch.isPending}
                      className={`text-xs px-3 py-1 rounded-lg font-medium transition-colors disabled:opacity-50 ${
                        u.is_active
                          ? "bg-red-50 text-red-600 hover:bg-red-100"
                          : "bg-green-50 text-green-700 hover:bg-green-100"
                      }`}
                    >
                      {u.is_active ? "Deactivate" : "Activate"}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      <Pagination
        page={page}
        totalPages={totalPages}
        onPrev={() => setPage(p => p - 1)}
        onNext={() => setPage(p => p + 1)}
      />
    </div>
  )
}

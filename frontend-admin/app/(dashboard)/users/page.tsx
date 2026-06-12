"use client"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { api } from "@/lib/api"
import { PageHeader } from "@/components/page-header"
import { StatusBadge } from "@/components/status-badge"
import type { User } from "@/lib/types"

export default function UsersPage() {
  const qc = useQueryClient()

  const { data: users = [], isLoading } = useQuery<User[]>({
    queryKey: ["users"],
    queryFn: () => api.get("/api/auth/users"),
  })

  const patch = useMutation({
    mutationFn: ({ id, body }: { id: string; body: { is_active?: boolean; role?: string } }) =>
      api.patch<User>(`/api/auth/users/${id}`, body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["users"] }),
  })

  if (isLoading) {
    return (
      <div>
        <PageHeader title="Users" description="Manage customer and staff accounts" />
        <div className="flex justify-center py-20">
          <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
        </div>
      </div>
    )
  }

  return (
    <div>
      <PageHeader title="Users" description={`${users.length} accounts`} />
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
  )
}

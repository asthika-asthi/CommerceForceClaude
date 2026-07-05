"use client"
import React, { useState } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { api } from "@/lib/api"
import type { CreditAccount } from "@/lib/types"
import { PageHeader } from "@/components/page-header"
import { StatusBadge } from "@/components/status-badge"
import { Pencil, Trash2, X } from "lucide-react"
import { CURRENCY_SYMBOL, formatMoney } from "@/lib/currency"

export default function CreditPage() {
  const qc = useQueryClient()
  const { data: accounts = [], isLoading } = useQuery<CreditAccount[]>({
    queryKey: ["credit-accounts"],
    queryFn: () => api.get("/api/credit/accounts"),
  })
  const [showCreate, setShowCreate] = useState(false)
  const [createForm, setCreateForm] = useState({ user_id: "", credit_limit: "", notes: "" })
  const [editId, setEditId] = useState<string | null>(null)
  const [editForm, setEditForm] = useState({ credit_limit: "", is_active: true, notes: "" })
  const [createError, setCreateError] = useState("")
  const [editError, setEditError] = useState("")
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null)

  const create = useMutation({
    mutationFn: (d: typeof createForm) =>
      api.post("/api/credit/accounts", { user_id: d.user_id, credit_limit: parseFloat(d.credit_limit), notes: d.notes || undefined }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["credit-accounts"] })
      setShowCreate(false)
      setCreateForm({ user_id: "", credit_limit: "", notes: "" })
      setCreateError("")
    },
    onError: (e) => setCreateError(e instanceof Error ? e.message : "Failed"),
  })

  const update = useMutation({
    mutationFn: ({ userId, data }: { userId: string; data: typeof editForm }) =>
      api.put(`/api/credit/accounts/${userId}`, { credit_limit: parseFloat(data.credit_limit), is_active: data.is_active, notes: data.notes || undefined }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["credit-accounts"] })
      setEditId(null)
      setEditError("")
    },
    onError: (e) => setEditError(e instanceof Error ? e.message : "Failed"),
  })

  const deleteAccount = useMutation({
    mutationFn: (userId: string) => api.del(`/api/credit/accounts/${userId}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["credit-accounts"] }); setDeleteTarget(null) },
  })

  function startEdit(a: CreditAccount) {
    setEditId(a.user_id)
    setEditForm({ credit_limit: a.credit_limit, is_active: a.is_active, notes: a.notes ?? "" })
    setEditError("")
  }

  return (
    <div>
      <PageHeader
        title="Credit Accounts"
        description="B2B credit limits and balances"
        action={{ label: showCreate ? "Cancel" : "+ New Account", onClick: () => { setShowCreate((v) => !v); setCreateError("") } }}
      />

      {showCreate && (
        <form onSubmit={(e) => { e.preventDefault(); create.mutate(createForm) }}
          className="bg-white rounded-xl border border-slate-200 p-5 mb-6 grid grid-cols-3 gap-4">
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">User ID *</label>
            <input required value={createForm.user_id}
              onChange={(e) => setCreateForm((f) => ({ ...f, user_id: e.target.value }))}
              placeholder="UUID of the user"
              className="w-full border border-slate-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Credit Limit ({CURRENCY_SYMBOL}) *</label>
            <input required type="number" min="0" step="0.01" value={createForm.credit_limit}
              onChange={(e) => setCreateForm((f) => ({ ...f, credit_limit: e.target.value }))}
              className="w-full border border-slate-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Notes</label>
            <input value={createForm.notes}
              onChange={(e) => setCreateForm((f) => ({ ...f, notes: e.target.value }))}
              className="w-full border border-slate-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          {createError && <p className="col-span-3 text-sm text-red-600">{createError}</p>}
          <div className="col-span-3">
            <button type="submit" disabled={create.isPending}
              className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm disabled:opacity-50">
              {create.isPending ? "Creating…" : "Create Account"}
            </button>
          </div>
        </form>
      )}

      {isLoading ? (
        <div className="flex justify-center py-12"><div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" /></div>
      ) : (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                {["User", "Limit", "Used", "Available", "Status", ""].map((h) => (
                  <th key={h} className="text-left px-4 py-3 font-medium text-slate-600">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {accounts.length === 0 && (
                <tr><td colSpan={6} className="text-center py-10 text-slate-400">No credit accounts</td></tr>
              )}
              {accounts.map((a) => (
                <React.Fragment key={a.id}>
                  <tr className={`hover:bg-slate-50 ${editId === a.user_id ? "bg-blue-50" : ""}`}>
                    <td className="px-4 py-2.5 font-mono text-xs text-slate-700">{a.user_id.slice(0, 12)}…</td>
                    <td className="px-4 py-2.5 text-slate-800">{formatMoney(parseFloat(a.credit_limit).toFixed(2))}</td>
                    <td className="px-4 py-2.5 text-slate-600">{formatMoney(parseFloat(a.used_credit).toFixed(2))}</td>
                    <td className="px-4 py-2.5 font-medium text-green-700">{formatMoney(parseFloat(a.available_credit).toFixed(2))}</td>
                    <td className="px-4 py-2.5"><StatusBadge value={a.is_active ? "active" : "inactive"} /></td>
                    <td className="px-4 py-2.5">
                      <div className="flex items-center gap-1">
                        {editId === a.user_id ? (
                          <button onClick={() => { setEditId(null); setEditError("") }} disabled={update.isPending} className="p-1.5 rounded hover:bg-slate-100 text-slate-400 disabled:opacity-50"><X size={13} /></button>
                        ) : (
                          <button onClick={() => startEdit(a)} className="p-1.5 rounded hover:bg-blue-50 text-slate-400 hover:text-blue-600"><Pencil size={13} /></button>
                        )}
                        <button onClick={() => setDeleteTarget(a.user_id)} className="p-1.5 rounded hover:bg-red-50 text-slate-400 hover:text-red-600"><Trash2 size={13} /></button>
                      </div>
                    </td>
                  </tr>
                  {editId === a.user_id && (
                    <tr className="bg-blue-50">
                      <td colSpan={6} className="px-4 py-3">
                        <form onSubmit={(e) => { e.preventDefault(); update.mutate({ userId: a.user_id, data: editForm }) }}
                          className="flex gap-4 items-end flex-wrap">
                          <div>
                            <label className="block text-xs font-medium text-slate-600 mb-1">Credit Limit ({CURRENCY_SYMBOL})</label>
                            <input type="number" min="0" step="0.01" required value={editForm.credit_limit}
                              onChange={(e) => setEditForm((f) => ({ ...f, credit_limit: e.target.value }))}
                              className="w-32 border border-slate-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-slate-600 mb-1">Notes</label>
                            <input value={editForm.notes}
                              onChange={(e) => setEditForm((f) => ({ ...f, notes: e.target.value }))}
                              className="w-48 border border-slate-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                          </div>
                          <label className="flex items-center gap-2 text-sm text-slate-700 pb-1">
                            <input type="checkbox" checked={editForm.is_active}
                              onChange={(e) => setEditForm((f) => ({ ...f, is_active: e.target.checked }))} />
                            Active
                          </label>
                          {editError && <p className="text-sm text-red-600">{editError}</p>}
                          <button type="submit" disabled={update.isPending}
                            className="bg-blue-600 text-white px-4 py-1.5 rounded-lg text-sm disabled:opacity-50">
                            {update.isPending ? "Saving…" : "Save"}
                          </button>
                        </form>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {deleteTarget && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl p-6 max-w-sm w-full mx-4">
            <h3 className="font-semibold text-slate-800 mb-2">Delete credit account?</h3>
            <p className="text-sm text-slate-600 mb-4">This will permanently remove this account. Any outstanding credit will not be automatically reconciled.</p>
            <div className="flex gap-3 justify-end">
              <button onClick={() => setDeleteTarget(null)} className="px-4 py-2 text-sm border border-slate-300 rounded-lg text-slate-600">Cancel</button>
              <button onClick={() => deleteAccount.mutate(deleteTarget)} disabled={deleteAccount.isPending}
                className="px-4 py-2 text-sm bg-red-600 text-white rounded-lg disabled:opacity-50">
                {deleteAccount.isPending ? "Deleting…" : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

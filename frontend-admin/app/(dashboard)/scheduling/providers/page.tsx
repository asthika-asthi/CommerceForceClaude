"use client"
import React, { useState } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { api } from "@/lib/api"
import type { Paginated, SchedulingProviderList, SchedulingProvider } from "@/lib/types"
import { PageHeader } from "@/components/page-header"
import { StatusBadge } from "@/components/status-badge"
import { Pencil, Trash2, X } from "lucide-react"

const emptyCreateForm = {
  display_name: "",
  title: "",
  specialty: "",
  color: "",
  can_view_all_clients: false,
  is_active: true,
}

type EditFormState = {
  display_name: string
  title: string
  specialty: string
  color: string
  can_view_all_clients: boolean
  is_active: boolean
}

export default function ProvidersPage() {
  const qc = useQueryClient()
  const { data, isLoading } = useQuery<Paginated<SchedulingProviderList>>({
    queryKey: ["scheduling-providers"],
    queryFn: () => api.get("/api/scheduling/providers?page=1&page_size=50"),
  })
  const providers = data?.items ?? []

  const [showCreate, setShowCreate] = useState(false)
  const [createForm, setCreateForm] = useState(emptyCreateForm)
  const [createError, setCreateError] = useState("")

  const [editId, setEditId] = useState<string | null>(null)
  const [editForm, setEditForm] = useState<EditFormState>({
    display_name: "", title: "", specialty: "", color: "", can_view_all_clients: false, is_active: true,
  })
  const [editError, setEditError] = useState("")

  const [deleteTarget, setDeleteTarget] = useState<string | null>(null)

  const create = useMutation({
    mutationFn: (d: typeof createForm) =>
      api.post("/api/scheduling/providers", {
        display_name: d.display_name,
        title: d.title || undefined,
        specialty: d.specialty || undefined,
        color: d.color || undefined,
        can_view_all_clients: d.can_view_all_clients,
        is_active: d.is_active,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["scheduling-providers"] })
      setShowCreate(false)
      setCreateForm(emptyCreateForm)
      setCreateError("")
    },
    onError: (e) => setCreateError(e instanceof Error ? e.message : "Failed"),
  })

  const update = useMutation({
    mutationFn: ({ id, data }: { id: string; data: EditFormState }) =>
      api.patch(`/api/scheduling/providers/${id}`, {
        display_name: data.display_name,
        title: data.title || undefined,
        specialty: data.specialty || undefined,
        color: data.color || undefined,
        can_view_all_clients: data.can_view_all_clients,
        is_active: data.is_active,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["scheduling-providers"] })
      setEditId(null)
      setEditError("")
    },
    onError: (e) => setEditError(e instanceof Error ? e.message : "Failed"),
  })

  const deleteProvider = useMutation({
    mutationFn: (id: string) => api.del(`/api/scheduling/providers/${id}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["scheduling-providers"] }); setDeleteTarget(null) },
  })

  function startEdit(p: SchedulingProviderList) {
    // The list row doesn't carry every field; fetch full record before editing.
    api.get<SchedulingProvider>(`/api/scheduling/providers/${p.id}`).then((full) => {
      setEditId(p.id)
      setEditForm({
        display_name: full.display_name,
        title: full.title ?? "",
        specialty: full.specialty ?? "",
        color: full.color ?? "",
        can_view_all_clients: full.can_view_all_clients,
        is_active: full.is_active,
      })
      setEditError("")
    })
  }

  return (
    <div>
      <PageHeader
        title="Providers"
        description="Doctors / practitioners who take appointments"
        action={{ label: showCreate ? "Cancel" : "+ New Provider", onClick: () => { setShowCreate((v) => !v); setCreateError("") } }}
      />

      {showCreate && (
        <form onSubmit={(e) => { e.preventDefault(); create.mutate(createForm) }}
          className="bg-white rounded-xl border border-slate-200 p-5 mb-6 grid grid-cols-3 gap-4">
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Display Name *</label>
            <input required value={createForm.display_name}
              onChange={(e) => setCreateForm((f) => ({ ...f, display_name: e.target.value }))}
              className="w-full border border-slate-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Title</label>
            <input value={createForm.title}
              onChange={(e) => setCreateForm((f) => ({ ...f, title: e.target.value }))}
              placeholder="e.g. Dr."
              className="w-full border border-slate-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Specialty</label>
            <input value={createForm.specialty}
              onChange={(e) => setCreateForm((f) => ({ ...f, specialty: e.target.value }))}
              className="w-full border border-slate-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Color</label>
            <input type="color" value={createForm.color || "#2563eb"}
              onChange={(e) => setCreateForm((f) => ({ ...f, color: e.target.value }))}
              className="w-full h-9 border border-slate-300 rounded-lg px-1 py-1" />
          </div>
          <label className="flex items-center gap-2 text-sm text-slate-700 pb-1">
            <input type="checkbox" checked={createForm.can_view_all_clients}
              onChange={(e) => setCreateForm((f) => ({ ...f, can_view_all_clients: e.target.checked }))} />
            Can view all clients
          </label>
          <label className="flex items-center gap-2 text-sm text-slate-700 pb-1">
            <input type="checkbox" checked={createForm.is_active}
              onChange={(e) => setCreateForm((f) => ({ ...f, is_active: e.target.checked }))} />
            Active
          </label>
          {createError && <p className="col-span-3 text-sm text-red-600">{createError}</p>}
          <div className="col-span-3">
            <button type="submit" disabled={create.isPending}
              className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm disabled:opacity-50">
              {create.isPending ? "Creating…" : "Create Provider"}
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
                {["Name", "Title", "Specialty", "Status", ""].map((h) => (
                  <th key={h} className="text-left px-4 py-3 font-medium text-slate-600">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {providers.length === 0 && (
                <tr><td colSpan={5} className="text-center py-10 text-slate-400">No providers</td></tr>
              )}
              {providers.map((p) => (
                <React.Fragment key={p.id}>
                  <tr className={`hover:bg-slate-50 ${editId === p.id ? "bg-blue-50" : ""}`}>
                    <td className="px-4 py-2.5 font-medium text-slate-800">{p.display_name}</td>
                    <td className="px-4 py-2.5 text-slate-600">{p.title ?? "—"}</td>
                    <td className="px-4 py-2.5 text-slate-600">{p.specialty ?? "—"}</td>
                    <td className="px-4 py-2.5"><StatusBadge value={p.is_active ? "active" : "inactive"} /></td>
                    <td className="px-4 py-2.5">
                      <div className="flex items-center gap-1">
                        {editId === p.id ? (
                          <button onClick={() => { setEditId(null); setEditError("") }} disabled={update.isPending} className="p-1.5 rounded hover:bg-slate-100 text-slate-400 disabled:opacity-50"><X size={13} /></button>
                        ) : (
                          <button onClick={() => startEdit(p)} className="p-1.5 rounded hover:bg-blue-50 text-slate-400 hover:text-blue-600"><Pencil size={13} /></button>
                        )}
                        <button onClick={() => setDeleteTarget(p.id)} className="p-1.5 rounded hover:bg-red-50 text-slate-400 hover:text-red-600"><Trash2 size={13} /></button>
                      </div>
                    </td>
                  </tr>
                  {editId === p.id && (
                    <tr className="bg-blue-50">
                      <td colSpan={5} className="px-4 py-3">
                        <form onSubmit={(e) => { e.preventDefault(); update.mutate({ id: p.id, data: editForm }) }}
                          className="flex gap-4 items-end flex-wrap">
                          <div>
                            <label className="block text-xs font-medium text-slate-600 mb-1">Display Name</label>
                            <input required value={editForm.display_name}
                              onChange={(e) => setEditForm((f) => ({ ...f, display_name: e.target.value }))}
                              className="w-40 border border-slate-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-slate-600 mb-1">Title</label>
                            <input value={editForm.title}
                              onChange={(e) => setEditForm((f) => ({ ...f, title: e.target.value }))}
                              className="w-32 border border-slate-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-slate-600 mb-1">Specialty</label>
                            <input value={editForm.specialty}
                              onChange={(e) => setEditForm((f) => ({ ...f, specialty: e.target.value }))}
                              className="w-40 border border-slate-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-slate-600 mb-1">Color</label>
                            <input type="color" value={editForm.color || "#2563eb"}
                              onChange={(e) => setEditForm((f) => ({ ...f, color: e.target.value }))}
                              className="w-16 h-9 border border-slate-300 rounded-lg px-1 py-1" />
                          </div>
                          <label className="flex items-center gap-2 text-sm text-slate-700 pb-1">
                            <input type="checkbox" checked={editForm.can_view_all_clients}
                              onChange={(e) => setEditForm((f) => ({ ...f, can_view_all_clients: e.target.checked }))} />
                            Can view all clients
                          </label>
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
            <h3 className="font-semibold text-slate-800 mb-2">Delete provider?</h3>
            <p className="text-sm text-slate-600 mb-4">This will deactivate the provider. Existing appointments are not affected.</p>
            <div className="flex gap-3 justify-end">
              <button onClick={() => setDeleteTarget(null)} className="px-4 py-2 text-sm border border-slate-300 rounded-lg text-slate-600">Cancel</button>
              <button onClick={() => deleteProvider.mutate(deleteTarget)} disabled={deleteProvider.isPending}
                className="px-4 py-2 text-sm bg-red-600 text-white rounded-lg disabled:opacity-50">
                {deleteProvider.isPending ? "Deleting…" : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

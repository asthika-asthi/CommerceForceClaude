"use client"
import React, { useState } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { api } from "@/lib/api"
import type {
  Paginated,
  SchedulingAppointmentTypeList,
  SchedulingAppointmentType,
  SchedulingProviderList,
} from "@/lib/types"
import { PageHeader } from "@/components/page-header"
import { StatusBadge } from "@/components/status-badge"
import { Pencil, Trash2, X } from "lucide-react"
import { CURRENCY_SYMBOL, formatMoney } from "@/lib/currency"

const emptyCreateForm = {
  name: "",
  duration_minutes: "30",
  price: "",
  description: "",
  provider_ids: [] as string[],
  is_active: true,
}

type EditFormState = {
  name: string
  duration_minutes: string
  price: string
  description: string
  provider_ids: string[]
  is_active: boolean
}

function ProviderCheckboxes({
  providers,
  selected,
  onToggle,
}: {
  providers: SchedulingProviderList[]
  selected: string[]
  onToggle: (id: string) => void
}) {
  if (providers.length === 0) {
    return <p className="text-xs text-slate-400">No providers yet — create one first.</p>
  }
  return (
    <div>
      <div className="flex flex-wrap gap-3">
        {providers.map((p) => (
          <label key={p.id} className="flex items-center gap-1.5 text-sm text-slate-700">
            <input type="checkbox" checked={selected.includes(p.id)} onChange={() => onToggle(p.id)} />
            {p.display_name}
          </label>
        ))}
      </div>
      <p className={`text-xs mt-1.5 ${selected.length === 0 ? "text-amber-600" : "text-slate-400"}`}>
        {selected.length === 0
          ? "⚠ Select at least one provider — a type with no provider can't be booked."
          : "These providers offer this service and can be booked for it."}
      </p>
    </div>
  )
}

export default function AppointmentTypesPage() {
  const qc = useQueryClient()
  const { data, isLoading } = useQuery<Paginated<SchedulingAppointmentTypeList>>({
    queryKey: ["scheduling-appointment-types"],
    queryFn: () => api.get("/api/scheduling/appointment-types?page=1&page_size=50"),
  })
  const types = data?.items ?? []

  const { data: providersData } = useQuery<Paginated<SchedulingProviderList>>({
    queryKey: ["scheduling-providers"],
    queryFn: () => api.get("/api/scheduling/providers?page=1&page_size=50"),
  })
  const providers = providersData?.items ?? []

  const [showCreate, setShowCreate] = useState(false)
  const [createForm, setCreateForm] = useState(emptyCreateForm)
  const [createError, setCreateError] = useState("")

  const [editId, setEditId] = useState<string | null>(null)
  const [editForm, setEditForm] = useState<EditFormState>({
    name: "", duration_minutes: "30", price: "", description: "", provider_ids: [], is_active: true,
  })
  const [editError, setEditError] = useState("")

  const [deleteTarget, setDeleteTarget] = useState<string | null>(null)

  const create = useMutation({
    mutationFn: (d: typeof createForm) =>
      api.post("/api/scheduling/appointment-types", {
        name: d.name,
        duration_minutes: parseInt(d.duration_minutes, 10),
        price: d.price ? parseFloat(d.price) : undefined,
        description: d.description || undefined,
        provider_ids: d.provider_ids,
        is_active: d.is_active,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["scheduling-appointment-types"] })
      setShowCreate(false)
      setCreateForm(emptyCreateForm)
      setCreateError("")
    },
    onError: (e) => setCreateError(e instanceof Error ? e.message : "Failed"),
  })

  const update = useMutation({
    mutationFn: ({ id, data }: { id: string; data: EditFormState }) =>
      api.patch(`/api/scheduling/appointment-types/${id}`, {
        name: data.name,
        duration_minutes: parseInt(data.duration_minutes, 10),
        price: data.price ? parseFloat(data.price) : undefined,
        description: data.description || undefined,
        provider_ids: data.provider_ids,
        is_active: data.is_active,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["scheduling-appointment-types"] })
      setEditId(null)
      setEditError("")
    },
    onError: (e) => setEditError(e instanceof Error ? e.message : "Failed"),
  })

  const deleteType = useMutation({
    mutationFn: (id: string) => api.del(`/api/scheduling/appointment-types/${id}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["scheduling-appointment-types"] }); setDeleteTarget(null) },
  })

  function startEdit(t: SchedulingAppointmentTypeList) {
    // The list row doesn't carry description/providers; fetch full record before editing.
    api.get<SchedulingAppointmentType>(`/api/scheduling/appointment-types/${t.id}`).then((full) => {
      setEditId(t.id)
      setEditForm({
        name: full.name,
        duration_minutes: String(full.duration_minutes),
        price: full.price ?? "",
        description: full.description ?? "",
        provider_ids: full.providers.map((p) => p.id),
        is_active: full.is_active,
      })
      setEditError("")
    })
  }

  function toggleCreateProvider(id: string) {
    setCreateForm((f) => ({
      ...f,
      provider_ids: f.provider_ids.includes(id) ? f.provider_ids.filter((x) => x !== id) : [...f.provider_ids, id],
    }))
  }

  function toggleEditProvider(id: string) {
    setEditForm((f) => ({
      ...f,
      provider_ids: f.provider_ids.includes(id) ? f.provider_ids.filter((x) => x !== id) : [...f.provider_ids, id],
    }))
  }

  return (
    <div>
      <PageHeader
        title="Appointment Types"
        description="Bookable services with duration and price"
        action={{ label: showCreate ? "Cancel" : "+ New Type", onClick: () => { setShowCreate((v) => !v); setCreateError("") } }}
      />

      {showCreate && (
        <form onSubmit={(e) => { e.preventDefault(); create.mutate(createForm) }}
          className="bg-white rounded-xl border border-slate-200 p-5 mb-6 grid grid-cols-3 gap-4">
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Name *</label>
            <input required value={createForm.name}
              onChange={(e) => setCreateForm((f) => ({ ...f, name: e.target.value }))}
              className="w-full border border-slate-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Duration (minutes) *</label>
            <input required type="number" min="1" step="1" value={createForm.duration_minutes}
              onChange={(e) => setCreateForm((f) => ({ ...f, duration_minutes: e.target.value }))}
              className="w-full border border-slate-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Price ({CURRENCY_SYMBOL})</label>
            <input type="number" min="0" step="0.01" value={createForm.price}
              onChange={(e) => setCreateForm((f) => ({ ...f, price: e.target.value }))}
              className="w-full border border-slate-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div className="col-span-3">
            <label className="block text-xs font-medium text-slate-600 mb-1">Description</label>
            <input value={createForm.description}
              onChange={(e) => setCreateForm((f) => ({ ...f, description: e.target.value }))}
              className="w-full border border-slate-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div className="col-span-3">
            <label className="block text-xs font-medium text-slate-600 mb-1">Providers</label>
            <ProviderCheckboxes providers={providers} selected={createForm.provider_ids} onToggle={toggleCreateProvider} />
          </div>
          <label className="flex items-center gap-2 text-sm text-slate-700 pb-1">
            <input type="checkbox" checked={createForm.is_active}
              onChange={(e) => setCreateForm((f) => ({ ...f, is_active: e.target.checked }))} />
            Active
          </label>
          {createError && <p className="col-span-3 text-sm text-red-600">{createError}</p>}
          <div className="col-span-3">
            <button type="submit" disabled={create.isPending}
              className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm disabled:opacity-50">
              {create.isPending ? "Creating…" : "Create Type"}
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
                {["Name", "Duration", "Price", "Status", ""].map((h) => (
                  <th key={h} className="text-left px-4 py-3 font-medium text-slate-600">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {types.length === 0 && (
                <tr><td colSpan={5} className="text-center py-10 text-slate-400">No appointment types</td></tr>
              )}
              {types.map((t) => (
                <React.Fragment key={t.id}>
                  <tr className={`hover:bg-slate-50 ${editId === t.id ? "bg-blue-50" : ""}`}>
                    <td className="px-4 py-2.5 font-medium text-slate-800">{t.name}</td>
                    <td className="px-4 py-2.5 text-slate-600">{t.duration_minutes} min</td>
                    <td className="px-4 py-2.5 text-slate-600">{t.price ? formatMoney(t.price) : "—"}</td>
                    <td className="px-4 py-2.5"><StatusBadge value={t.is_active ? "active" : "inactive"} /></td>
                    <td className="px-4 py-2.5">
                      <div className="flex items-center gap-1">
                        {editId === t.id ? (
                          <button onClick={() => { setEditId(null); setEditError("") }} disabled={update.isPending} className="p-1.5 rounded hover:bg-slate-100 text-slate-400 disabled:opacity-50"><X size={13} /></button>
                        ) : (
                          <button onClick={() => startEdit(t)} className="p-1.5 rounded hover:bg-blue-50 text-slate-400 hover:text-blue-600"><Pencil size={13} /></button>
                        )}
                        <button onClick={() => setDeleteTarget(t.id)} className="p-1.5 rounded hover:bg-red-50 text-slate-400 hover:text-red-600"><Trash2 size={13} /></button>
                      </div>
                    </td>
                  </tr>
                  {editId === t.id && (
                    <tr className="bg-blue-50">
                      <td colSpan={5} className="px-4 py-3">
                        <form onSubmit={(e) => { e.preventDefault(); update.mutate({ id: t.id, data: editForm }) }}
                          className="flex flex-col gap-3">
                          <div className="flex gap-4 items-end flex-wrap">
                            <div>
                              <label className="block text-xs font-medium text-slate-600 mb-1">Name</label>
                              <input required value={editForm.name}
                                onChange={(e) => setEditForm((f) => ({ ...f, name: e.target.value }))}
                                className="w-40 border border-slate-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                            </div>
                            <div>
                              <label className="block text-xs font-medium text-slate-600 mb-1">Duration (min)</label>
                              <input required type="number" min="1" step="1" value={editForm.duration_minutes}
                                onChange={(e) => setEditForm((f) => ({ ...f, duration_minutes: e.target.value }))}
                                className="w-24 border border-slate-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                            </div>
                            <div>
                              <label className="block text-xs font-medium text-slate-600 mb-1">Price ({CURRENCY_SYMBOL})</label>
                              <input type="number" min="0" step="0.01" value={editForm.price}
                                onChange={(e) => setEditForm((f) => ({ ...f, price: e.target.value }))}
                                className="w-28 border border-slate-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                            </div>
                            <div className="flex-1 min-w-[200px]">
                              <label className="block text-xs font-medium text-slate-600 mb-1">Description</label>
                              <input value={editForm.description}
                                onChange={(e) => setEditForm((f) => ({ ...f, description: e.target.value }))}
                                className="w-full border border-slate-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                            </div>
                            <label className="flex items-center gap-2 text-sm text-slate-700 pb-1">
                              <input type="checkbox" checked={editForm.is_active}
                                onChange={(e) => setEditForm((f) => ({ ...f, is_active: e.target.checked }))} />
                              Active
                            </label>
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-slate-600 mb-1">Providers</label>
                            <ProviderCheckboxes providers={providers} selected={editForm.provider_ids} onToggle={toggleEditProvider} />
                          </div>
                          {editError && <p className="text-sm text-red-600">{editError}</p>}
                          <div>
                            <button type="submit" disabled={update.isPending}
                              className="bg-blue-600 text-white px-4 py-1.5 rounded-lg text-sm disabled:opacity-50">
                              {update.isPending ? "Saving…" : "Save"}
                            </button>
                          </div>
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
            <h3 className="font-semibold text-slate-800 mb-2">Delete appointment type?</h3>
            <p className="text-sm text-slate-600 mb-4">This will deactivate the type. Existing appointments are not affected.</p>
            <div className="flex gap-3 justify-end">
              <button onClick={() => setDeleteTarget(null)} className="px-4 py-2 text-sm border border-slate-300 rounded-lg text-slate-600">Cancel</button>
              <button onClick={() => deleteType.mutate(deleteTarget)} disabled={deleteType.isPending}
                className="px-4 py-2 text-sm bg-red-600 text-white rounded-lg disabled:opacity-50">
                {deleteType.isPending ? "Deleting…" : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

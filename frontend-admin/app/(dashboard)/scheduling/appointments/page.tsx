"use client"
import { useEffect, useState } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { api } from "@/lib/api"
import type {
  Paginated,
  SchedulingAppointmentList,
  SchedulingAppointmentStatus,
  SchedulingProviderList,
  SchedulingAppointmentTypeList,
  SchedulingClientList,
} from "@/lib/types"
import { PageHeader } from "@/components/page-header"
import { StatusBadge } from "@/components/status-badge"
import { Pagination } from "@/components/ui/pagination"

const STATUS_OPTIONS: SchedulingAppointmentStatus[] = [
  "requested",
  "confirmed",
  "completed",
  "cancelled",
  "no_show",
]

// Non-cancel forward transitions only — cancellation always goes through the
// dedicated Cancel action so we can collect a reason.
const FORWARD_TRANSITIONS: Record<SchedulingAppointmentStatus, SchedulingAppointmentStatus[]> = {
  requested: ["confirmed", "no_show"],
  confirmed: ["completed", "no_show"],
  completed: [],
  cancelled: [],
  no_show: [],
}

const emptyCreateForm = {
  provider_id: "",
  appointment_type_id: "",
  client_id: "",
  client_label: "",
  start_local: "",
  reason: "",
}

function formatRange(startAt: string, endAt: string) {
  const start = new Date(startAt)
  const end = new Date(endAt)
  const datePart = start.toLocaleDateString([], { weekday: "short", month: "short", day: "numeric", year: "numeric" })
  const startTime = start.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })
  const endTime = end.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })
  return `${datePart}, ${startTime} – ${endTime}`
}

function ClientSearch({
  value,
  label,
  onSelect,
}: {
  value: string
  label: string
  onSelect: (id: string, label: string) => void
}) {
  const [query, setQuery] = useState("")
  const [debounced, setDebounced] = useState("")
  const [open, setOpen] = useState(false)

  useEffect(() => {
    const t = setTimeout(() => setDebounced(query), 300)
    return () => clearTimeout(t)
  }, [query])

  const canSearch = debounced.trim().length >= 2
  const { data } = useQuery<Paginated<SchedulingClientList>>({
    queryKey: ["scheduling-clients", debounced],
    queryFn: () => api.get(`/api/scheduling/clients?page=1&page_size=20&search=${encodeURIComponent(debounced.trim())}`),
    enabled: canSearch,
  })
  const results = data?.items ?? []

  // Once a client is chosen, show it with a "Change" affordance instead of the search box.
  if (value && label) {
    return (
      <div className="flex items-center gap-2">
        <span className="flex-1 text-sm text-slate-800 border border-slate-200 bg-slate-50 rounded-lg px-3 py-1.5">{label}</span>
        <button
          type="button"
          onClick={() => { onSelect("", ""); setQuery(""); setDebounced(""); setOpen(true) }}
          className="text-xs text-blue-600 hover:underline"
        >
          Change
        </button>
      </div>
    )
  }

  return (
    <div className="relative">
      <input
        type="text"
        value={query}
        onChange={(e) => { setQuery(e.target.value); setOpen(true) }}
        onFocus={() => setOpen(true)}
        placeholder="Search clients by name or email…"
        className="w-full border border-slate-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
      />
      {query.trim().length > 0 && !canSearch && (
        <p className="text-xs text-slate-400 mt-1">Type at least 2 characters to search.</p>
      )}
      {open && canSearch && (
        <div className="absolute z-20 mt-1 w-full bg-white border border-slate-200 rounded-lg shadow-lg max-h-56 overflow-auto">
          {results.length === 0 ? (
            <div className="px-3 py-2 text-sm text-slate-400">No matching clients. Add one on the Clients page first.</div>
          ) : (
            results.map((c) => (
              <button
                type="button"
                key={c.id}
                onClick={() => {
                  onSelect(c.id, `${c.first_name} ${c.last_name}${c.email ? ` (${c.email})` : ""}`)
                  setOpen(false)
                  setQuery("")
                }}
                className="block w-full text-left px-3 py-2 text-sm text-slate-700 hover:bg-blue-50"
              >
                {c.first_name} {c.last_name}{c.email ? <span className="text-slate-400"> · {c.email}</span> : null}
              </button>
            ))
          )}
        </div>
      )}
    </div>
  )
}

export default function AppointmentsPage() {
  const qc = useQueryClient()

  const [page, setPage] = useState(1)
  const [filterProviderId, setFilterProviderId] = useState("")
  const [filterStatus, setFilterStatus] = useState("")
  const [dateFrom, setDateFrom] = useState("")
  const [dateTo, setDateTo] = useState("")

  const { data: providersData } = useQuery<Paginated<SchedulingProviderList>>({
    queryKey: ["scheduling-providers"],
    queryFn: () => api.get("/api/scheduling/providers?page=1&page_size=100"),
  })
  const providers = providersData?.items ?? []

  const params = new URLSearchParams()
  params.set("page", String(page))
  params.set("page_size", "20")
  if (filterProviderId) params.set("provider_id", filterProviderId)
  if (filterStatus) params.set("status", filterStatus)
  if (dateFrom) params.set("date_from", dateFrom)
  if (dateTo) params.set("date_to", dateTo)

  const { data, isLoading } = useQuery<Paginated<SchedulingAppointmentList>>({
    queryKey: ["scheduling-appointments", page, filterProviderId, filterStatus, dateFrom, dateTo],
    queryFn: () => api.get(`/api/scheduling/appointments?${params.toString()}`),
  })
  const appointments = data?.items ?? []
  const totalPages = data ? data.pages : 1

  function resetToFirstPage() {
    setPage(1)
  }

  // ── Create form ──────────────────────────────────────────────────────────
  const [showCreate, setShowCreate] = useState(false)
  const [createForm, setCreateForm] = useState(emptyCreateForm)
  const [createError, setCreateError] = useState("")

  const { data: createTypesData } = useQuery<Paginated<SchedulingAppointmentTypeList>>({
    queryKey: ["scheduling-appointment-types", createForm.provider_id],
    queryFn: () => api.get(`/api/scheduling/appointment-types?page_size=100&provider_id=${createForm.provider_id}`),
    enabled: !!createForm.provider_id,
  })
  const createTypes = createTypesData?.items ?? []

  const create = useMutation({
    mutationFn: (d: typeof createForm) =>
      api.post("/api/scheduling/appointments", {
        provider_id: d.provider_id,
        appointment_type_id: d.appointment_type_id,
        client_id: d.client_id,
        start_at: new Date(d.start_local).toISOString(),
        reason: d.reason || undefined,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["scheduling-appointments"] })
      setShowCreate(false)
      setCreateForm(emptyCreateForm)
      setCreateError("")
    },
    onError: (e) => setCreateError(e instanceof Error ? e.message : "Failed"),
  })

  // ── Row actions ──────────────────────────────────────────────────────────
  const [actionError, setActionError] = useState("")
  const [cancelTarget, setCancelTarget] = useState<string | null>(null)
  const [cancelReason, setCancelReason] = useState("")

  const updateStatus = useMutation({
    mutationFn: ({ id, status }: { id: string; status: SchedulingAppointmentStatus }) =>
      api.patch(`/api/scheduling/appointments/${id}/status`, { status }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["scheduling-appointments"] })
      setActionError("")
    },
    onError: (e) => setActionError(e instanceof Error ? e.message : "Failed to update status"),
  })

  const reschedule = useMutation({
    mutationFn: ({ id, start_at }: { id: string; start_at: string }) =>
      api.post(`/api/scheduling/appointments/${id}/reschedule`, { start_at }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["scheduling-appointments"] })
      setActionError("")
    },
    onError: (e) => setActionError(e instanceof Error ? e.message : "Failed to reschedule"),
  })

  const cancel = useMutation({
    mutationFn: ({ id, cancellation_reason }: { id: string; cancellation_reason?: string }) =>
      api.post(`/api/scheduling/appointments/${id}/cancel`, { cancellation_reason }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["scheduling-appointments"] })
      setActionError("")
      setCancelTarget(null)
      setCancelReason("")
    },
    onError: (e) => setActionError(e instanceof Error ? e.message : "Failed to cancel"),
  })

  function handleReschedule(a: SchedulingAppointmentList) {
    const current = new Date(a.start_at)
    const pad = (n: number) => String(n).padStart(2, "0")
    const defaultVal = `${current.getFullYear()}-${pad(current.getMonth() + 1)}-${pad(current.getDate())}T${pad(current.getHours())}:${pad(current.getMinutes())}`
    const input = window.prompt("New date & time (YYYY-MM-DDTHH:mm):", defaultVal)
    if (!input) return
    const parsed = new Date(input)
    if (isNaN(parsed.getTime())) {
      setActionError("Invalid date/time entered")
      return
    }
    reschedule.mutate({ id: a.id, start_at: parsed.toISOString() })
  }

  return (
    <div>
      <PageHeader
        title="Appointments"
        description="All bookings across providers"
        action={{ label: showCreate ? "Cancel" : "+ New appointment", onClick: () => { setShowCreate((v) => !v); setCreateError("") } }}
      />

      {/* Filter bar */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 mb-6 flex flex-wrap items-end gap-4">
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Provider</label>
          <select
            value={filterProviderId}
            onChange={(e) => { setFilterProviderId(e.target.value); resetToFirstPage() }}
            className="border border-slate-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">All providers</option>
            {providers.map((p) => (
              <option key={p.id} value={p.id}>{p.display_name}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Status</label>
          <select
            value={filterStatus}
            onChange={(e) => { setFilterStatus(e.target.value); resetToFirstPage() }}
            className="border border-slate-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">All statuses</option>
            {STATUS_OPTIONS.map((s) => (
              <option key={s} value={s}>{s.replace("_", " ")}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">From</label>
          <input
            type="date"
            value={dateFrom}
            onChange={(e) => { setDateFrom(e.target.value); resetToFirstPage() }}
            className="border border-slate-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">To</label>
          <input
            type="date"
            value={dateTo}
            onChange={(e) => { setDateTo(e.target.value); resetToFirstPage() }}
            className="border border-slate-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        {(filterProviderId || filterStatus || dateFrom || dateTo) && (
          <button
            onClick={() => { setFilterProviderId(""); setFilterStatus(""); setDateFrom(""); setDateTo(""); resetToFirstPage() }}
            className="text-sm text-slate-500 hover:text-slate-700 underline"
          >
            Clear filters
          </button>
        )}
      </div>

      {showCreate && (
        <form onSubmit={(e) => { e.preventDefault(); create.mutate(createForm) }}
          className="bg-white rounded-xl border border-slate-200 p-5 mb-6 grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Provider *</label>
            <select required value={createForm.provider_id}
              onChange={(e) => setCreateForm((f) => ({ ...f, provider_id: e.target.value, appointment_type_id: "" }))}
              className="w-full border border-slate-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
              <option value="">Select a provider…</option>
              {providers.map((p) => (
                <option key={p.id} value={p.id}>{p.display_name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Appointment type *</label>
            <select required disabled={!createForm.provider_id} value={createForm.appointment_type_id}
              onChange={(e) => setCreateForm((f) => ({ ...f, appointment_type_id: e.target.value }))}
              className="w-full border border-slate-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-slate-50">
              <option value="">{createForm.provider_id ? "Select a type…" : "Pick a provider first"}</option>
              {createTypes.map((t) => (
                <option key={t.id} value={t.id}>{t.name} ({t.duration_minutes} min)</option>
              ))}
            </select>
            {createForm.provider_id && createTypesData && createTypes.length === 0 && (
              <p className="text-xs text-amber-600 mt-1">
                This provider isn&apos;t offering any appointment types yet. Assign this provider to a type on the{" "}
                <a href="/scheduling/types" className="underline font-medium">Appointment Types</a> page, then come back.
              </p>
            )}
          </div>
          <div className="col-span-2">
            <label className="block text-xs font-medium text-slate-600 mb-1">Client *</label>
            <ClientSearch
              value={createForm.client_id}
              label={createForm.client_label}
              onSelect={(id, label) => setCreateForm((f) => ({ ...f, client_id: id, client_label: label }))}
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Start date &amp; time *</label>
            <input required type="datetime-local" value={createForm.start_local}
              onChange={(e) => setCreateForm((f) => ({ ...f, start_local: e.target.value }))}
              className="w-full border border-slate-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Reason</label>
            <input value={createForm.reason}
              onChange={(e) => setCreateForm((f) => ({ ...f, reason: e.target.value }))}
              className="w-full border border-slate-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          {createError && <p className="col-span-2 text-sm text-red-600">{createError}</p>}
          <div className="col-span-2">
            <button type="submit" disabled={create.isPending || !createForm.client_id}
              className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm disabled:opacity-50">
              {create.isPending ? "Booking…" : "Book Appointment"}
            </button>
          </div>
        </form>
      )}

      {actionError && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-2 mb-4 flex items-center justify-between">
          <span>{actionError}</span>
          <button onClick={() => setActionError("")} className="text-red-500 hover:text-red-700 font-medium ml-4">Dismiss</button>
        </div>
      )}

      {isLoading ? (
        <div className="flex justify-center py-12"><div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" /></div>
      ) : (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                {["Date / time", "Provider", "Client", "Type", "Status", "Actions"].map((h) => (
                  <th key={h} className="text-left px-4 py-3 font-medium text-slate-600">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {appointments.length === 0 && (
                <tr><td colSpan={6} className="text-center py-10 text-slate-400">No appointments found</td></tr>
              )}
              {appointments.map((a) => {
                const forward = FORWARD_TRANSITIONS[a.status] ?? []
                const isEditable = a.status === "requested" || a.status === "confirmed"
                return (
                  <tr key={a.id} className="hover:bg-slate-50 align-top">
                    <td className="px-4 py-2.5 text-slate-700 whitespace-nowrap">{formatRange(a.start_at, a.end_at)}</td>
                    <td className="px-4 py-2.5 text-slate-600">{a.provider_name}</td>
                    <td className="px-4 py-2.5 text-slate-600">{a.client_name}</td>
                    <td className="px-4 py-2.5 text-slate-600">{a.appointment_type_name}</td>
                    <td className="px-4 py-2.5"><StatusBadge value={a.status} /></td>
                    <td className="px-4 py-2.5">
                      <div className="flex flex-wrap items-center gap-2">
                        {forward.length > 0 && (
                          <select
                            defaultValue=""
                            disabled={updateStatus.isPending}
                            onChange={(e) => {
                              if (!e.target.value) return
                              updateStatus.mutate({ id: a.id, status: e.target.value as SchedulingAppointmentStatus })
                              e.target.value = ""
                            }}
                            className="border border-slate-300 rounded-lg px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
                          >
                            <option value="">Set status…</option>
                            {forward.map((s) => (
                              <option key={s} value={s}>{s.replace("_", " ")}</option>
                            ))}
                          </select>
                        )}
                        {isEditable && (
                          <button onClick={() => handleReschedule(a)} className="text-xs text-blue-600 hover:underline">
                            Reschedule
                          </button>
                        )}
                        {isEditable && (
                          <button onClick={() => { setCancelTarget(a.id); setCancelReason("") }} className="text-xs text-red-600 hover:underline">
                            Cancel
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      <Pagination
        page={page}
        totalPages={totalPages}
        onPrev={() => setPage((p) => p - 1)}
        onNext={() => setPage((p) => p + 1)}
      />

      {cancelTarget && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl p-6 max-w-sm w-full mx-4">
            <h3 className="font-semibold text-slate-800 mb-2">Cancel appointment?</h3>
            <p className="text-sm text-slate-600 mb-3">This will mark the appointment as cancelled.</p>
            <label className="block text-xs font-medium text-slate-600 mb-1">Reason (optional)</label>
            <input value={cancelReason} onChange={(e) => setCancelReason(e.target.value)}
              className="w-full border border-slate-300 rounded-lg px-3 py-1.5 text-sm mb-4 focus:outline-none focus:ring-2 focus:ring-blue-500" />
            <div className="flex gap-3 justify-end">
              <button onClick={() => setCancelTarget(null)} className="px-4 py-2 text-sm border border-slate-300 rounded-lg text-slate-600">Keep it</button>
              <button
                onClick={() => cancel.mutate({ id: cancelTarget, cancellation_reason: cancelReason || undefined })}
                disabled={cancel.isPending}
                className="px-4 py-2 text-sm bg-red-600 text-white rounded-lg disabled:opacity-50"
              >
                {cancel.isPending ? "Cancelling…" : "Cancel appointment"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

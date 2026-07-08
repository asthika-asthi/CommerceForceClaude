"use client"
import { useState } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { api } from "@/lib/api"
import type {
  Paginated,
  SchedulingProviderList,
  SchedulingAvailability,
  SchedulingException,
} from "@/lib/types"
import { PageHeader } from "@/components/page-header"
import { Trash2 } from "lucide-react"

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]

export default function AvailabilityPage() {
  const qc = useQueryClient()
  const { data: providersData, isLoading: providersLoading } = useQuery<Paginated<SchedulingProviderList>>({
    queryKey: ["scheduling-providers"],
    queryFn: () => api.get("/api/scheduling/providers?page=1&page_size=50"),
  })
  const providers = providersData?.items ?? []
  const [providerId, setProviderId] = useState<string>("")

  const effectiveProviderId = providerId || providers[0]?.id || ""

  const { data: availability = [], isLoading: availLoading } = useQuery<SchedulingAvailability[]>({
    queryKey: ["scheduling-availability", effectiveProviderId],
    queryFn: () => api.get(`/api/scheduling/providers/${effectiveProviderId}/availability`),
    enabled: !!effectiveProviderId,
  })

  const { data: exceptions = [], isLoading: exceptionsLoading } = useQuery<SchedulingException[]>({
    queryKey: ["scheduling-exceptions", effectiveProviderId],
    queryFn: () => api.get(`/api/scheduling/providers/${effectiveProviderId}/exceptions`),
    enabled: !!effectiveProviderId,
  })

  const [availForm, setAvailForm] = useState({ weekday: "0", start_time: "09:00", end_time: "17:00" })
  const [availError, setAvailError] = useState("")

  const [excForm, setExcForm] = useState({ date: "", is_available: false, start_time: "", end_time: "" })
  const [excError, setExcError] = useState("")

  const createAvail = useMutation({
    mutationFn: (d: typeof availForm) =>
      api.post(`/api/scheduling/providers/${effectiveProviderId}/availability`, {
        weekday: parseInt(d.weekday, 10),
        start_time: `${d.start_time}:00`,
        end_time: `${d.end_time}:00`,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["scheduling-availability", effectiveProviderId] })
      setAvailError("")
    },
    onError: (e) => setAvailError(e instanceof Error ? e.message : "Failed"),
  })

  const deleteAvail = useMutation({
    mutationFn: (id: string) => api.del(`/api/scheduling/availability/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["scheduling-availability", effectiveProviderId] }),
  })

  const createExc = useMutation({
    mutationFn: (d: typeof excForm) =>
      api.post(`/api/scheduling/providers/${effectiveProviderId}/exceptions`, {
        date: d.date,
        is_available: d.is_available,
        start_time: d.is_available && d.start_time ? `${d.start_time}:00` : undefined,
        end_time: d.is_available && d.end_time ? `${d.end_time}:00` : undefined,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["scheduling-exceptions", effectiveProviderId] })
      setExcForm({ date: "", is_available: false, start_time: "", end_time: "" })
      setExcError("")
    },
    onError: (e) => setExcError(e instanceof Error ? e.message : "Failed"),
  })

  const deleteExc = useMutation({
    mutationFn: (id: string) => api.del(`/api/scheduling/exceptions/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["scheduling-exceptions", effectiveProviderId] }),
  })

  return (
    <div>
      <PageHeader title="Availability" description="Weekly hours and date-specific overrides per provider" />

      {providersLoading ? (
        <div className="flex justify-center py-12"><div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" /></div>
      ) : providers.length === 0 ? (
        <p className="text-sm text-slate-400">No providers yet — create one on the Providers page first.</p>
      ) : (
        <>
          <div className="mb-6 max-w-xs">
            <label className="block text-xs font-medium text-slate-600 mb-1">Provider</label>
            <select value={effectiveProviderId} onChange={(e) => setProviderId(e.target.value)}
              className="w-full border border-slate-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
              {providers.map((p) => (
                <option key={p.id} value={p.id}>{p.display_name}</option>
              ))}
            </select>
          </div>

          {/* Weekly availability */}
          <div className="bg-white rounded-xl border border-slate-200 p-5 mb-6">
            <h3 className="font-semibold text-slate-800 mb-3">Weekly Hours</h3>
            <form onSubmit={(e) => { e.preventDefault(); createAvail.mutate(availForm) }}
              className="flex gap-3 items-end flex-wrap mb-4">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Day</label>
                <select value={availForm.weekday} onChange={(e) => setAvailForm((f) => ({ ...f, weekday: e.target.value }))}
                  className="border border-slate-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                  {WEEKDAYS.map((label, idx) => (
                    <option key={idx} value={idx}>{label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Start</label>
                <input type="time" required value={availForm.start_time}
                  onChange={(e) => setAvailForm((f) => ({ ...f, start_time: e.target.value }))}
                  className="border border-slate-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">End</label>
                <input type="time" required value={availForm.end_time}
                  onChange={(e) => setAvailForm((f) => ({ ...f, end_time: e.target.value }))}
                  className="border border-slate-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <button type="submit" disabled={createAvail.isPending}
                className="bg-blue-600 text-white px-4 py-1.5 rounded-lg text-sm disabled:opacity-50">
                {createAvail.isPending ? "Adding…" : "+ Add"}
              </button>
              {availError && <p className="text-sm text-red-600 w-full">{availError}</p>}
            </form>

            {availLoading ? (
              <div className="flex justify-center py-6"><div className="w-5 h-5 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" /></div>
            ) : availability.length === 0 ? (
              <p className="text-sm text-slate-400">No weekly hours set for this provider.</p>
            ) : (
              <table className="w-full text-sm">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr>
                    {["Day", "Start", "End", ""].map((h) => (
                      <th key={h} className="text-left px-3 py-2 font-medium text-slate-600">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {[...availability]
                    .sort((a, b) => a.weekday - b.weekday || a.start_time.localeCompare(b.start_time))
                    .map((a) => (
                      <tr key={a.id} className="hover:bg-slate-50">
                        <td className="px-3 py-2 text-slate-800">{WEEKDAYS[a.weekday]}</td>
                        <td className="px-3 py-2 text-slate-600">{a.start_time.slice(0, 5)}</td>
                        <td className="px-3 py-2 text-slate-600">{a.end_time.slice(0, 5)}</td>
                        <td className="px-3 py-2">
                          <button onClick={() => deleteAvail.mutate(a.id)} className="p-1.5 rounded hover:bg-red-50 text-slate-400 hover:text-red-600"><Trash2 size={13} /></button>
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            )}
          </div>

          {/* Date exceptions */}
          <div className="bg-white rounded-xl border border-slate-200 p-5">
            <h3 className="font-semibold text-slate-800 mb-3">Date Exceptions</h3>
            <form onSubmit={(e) => { e.preventDefault(); createExc.mutate(excForm) }}
              className="flex gap-3 items-end flex-wrap mb-4">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Date</label>
                <input type="date" required value={excForm.date}
                  onChange={(e) => setExcForm((f) => ({ ...f, date: e.target.value }))}
                  className="border border-slate-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <label className="flex items-center gap-2 text-sm text-slate-700 pb-1.5">
                <input type="checkbox" checked={excForm.is_available}
                  onChange={(e) => setExcForm((f) => ({ ...f, is_available: e.target.checked }))} />
                Available (uncheck to block the day)
              </label>
              {excForm.is_available && (
                <>
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">Start</label>
                    <input type="time" value={excForm.start_time}
                      onChange={(e) => setExcForm((f) => ({ ...f, start_time: e.target.value }))}
                      className="border border-slate-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">End</label>
                    <input type="time" value={excForm.end_time}
                      onChange={(e) => setExcForm((f) => ({ ...f, end_time: e.target.value }))}
                      className="border border-slate-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                  </div>
                </>
              )}
              <button type="submit" disabled={createExc.isPending}
                className="bg-blue-600 text-white px-4 py-1.5 rounded-lg text-sm disabled:opacity-50">
                {createExc.isPending ? "Adding…" : "+ Add"}
              </button>
              {excError && <p className="text-sm text-red-600 w-full">{excError}</p>}
            </form>

            {exceptionsLoading ? (
              <div className="flex justify-center py-6"><div className="w-5 h-5 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" /></div>
            ) : exceptions.length === 0 ? (
              <p className="text-sm text-slate-400">No date exceptions for this provider.</p>
            ) : (
              <table className="w-full text-sm">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr>
                    {["Date", "Status", "Hours", ""].map((h) => (
                      <th key={h} className="text-left px-3 py-2 font-medium text-slate-600">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {[...exceptions]
                    .sort((a, b) => a.date.localeCompare(b.date))
                    .map((ex) => (
                      <tr key={ex.id} className="hover:bg-slate-50">
                        <td className="px-3 py-2 text-slate-800">{ex.date}</td>
                        <td className="px-3 py-2">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${ex.is_available ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"}`}>
                            {ex.is_available ? "available" : "blocked"}
                          </span>
                        </td>
                        <td className="px-3 py-2 text-slate-600">
                          {ex.is_available && ex.start_time && ex.end_time ? `${ex.start_time.slice(0, 5)} – ${ex.end_time.slice(0, 5)}` : "—"}
                        </td>
                        <td className="px-3 py-2">
                          <button onClick={() => deleteExc.mutate(ex.id)} className="p-1.5 rounded hover:bg-red-50 text-slate-400 hover:text-red-600"><Trash2 size={13} /></button>
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            )}
          </div>
        </>
      )}
    </div>
  )
}

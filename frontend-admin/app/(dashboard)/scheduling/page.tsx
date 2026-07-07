"use client"
import { useState } from "react"
import { useQuery } from "@tanstack/react-query"
import Link from "next/link"
import { api } from "@/lib/api"
import type { Paginated, SchedulingAppointmentList, SchedulingProviderList } from "@/lib/types"
import { PageHeader } from "@/components/page-header"

const DAY_LABELS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]

const STATUS_DOT: Record<string, string> = {
  requested: "bg-amber-400",
  confirmed: "bg-blue-500",
  completed: "bg-green-500",
  cancelled: "bg-red-400",
  no_show: "bg-orange-400",
}

function pad(n: number) {
  return String(n).padStart(2, "0")
}

function dateKey(d: Date) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

/** Monday of the week containing `d`, at local midnight. */
function startOfWeek(d: Date) {
  const copy = new Date(d.getFullYear(), d.getMonth(), d.getDate())
  const day = copy.getDay() // 0 = Sunday
  const diff = day === 0 ? -6 : 1 - day // shift back to Monday
  copy.setDate(copy.getDate() + diff)
  return copy
}

function addDays(d: Date, n: number) {
  const copy = new Date(d)
  copy.setDate(copy.getDate() + n)
  return copy
}

export default function SchedulingCalendarPage() {
  const [weekOffset, setWeekOffset] = useState(0)
  const [providerId, setProviderId] = useState("")

  const monday = addDays(startOfWeek(new Date()), weekOffset * 7)
  const days = Array.from({ length: 7 }, (_, i) => addDays(monday, i))
  const sunday = days[6]

  const { data: providersData } = useQuery<Paginated<SchedulingProviderList>>({
    queryKey: ["scheduling-providers"],
    queryFn: () => api.get("/api/scheduling/providers?page=1&page_size=100"),
  })
  const providers = providersData?.items ?? []

  const params = new URLSearchParams()
  params.set("date_from", dateKey(monday))
  params.set("date_to", dateKey(sunday))
  params.set("page_size", "100")
  if (providerId) params.set("provider_id", providerId)

  const { data, isLoading } = useQuery<Paginated<SchedulingAppointmentList>>({
    queryKey: ["scheduling-appointments-week", dateKey(monday), dateKey(sunday), providerId],
    queryFn: () => api.get(`/api/scheduling/appointments?${params.toString()}`),
  })
  const appointments = data?.items ?? []

  const byDay = new Map<string, SchedulingAppointmentList[]>()
  for (const day of days) byDay.set(dateKey(day), [])
  for (const a of appointments) {
    const key = dateKey(new Date(a.start_at))
    const bucket = byDay.get(key)
    if (bucket) bucket.push(a)
  }
  for (const bucket of byDay.values()) {
    bucket.sort((a, b) => a.start_at.localeCompare(b.start_at))
  }

  const rangeLabel = `${monday.toLocaleDateString([], { month: "short", day: "numeric" })} – ${sunday.toLocaleDateString([], { month: "short", day: "numeric", year: "numeric" })}`

  return (
    <div>
      <PageHeader title="Scheduling calendar" description="Week agenda across all providers" />

      <div className="bg-white rounded-xl border border-slate-200 p-4 mb-6 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setWeekOffset((w) => w - 1)}
            className="px-3 py-1.5 rounded-lg text-sm border border-slate-300 text-slate-600 hover:bg-slate-50"
          >
            ← Prev week
          </button>
          <span className="text-sm font-medium text-slate-800 min-w-[180px] text-center">{rangeLabel}</span>
          <button
            onClick={() => setWeekOffset((w) => w + 1)}
            className="px-3 py-1.5 rounded-lg text-sm border border-slate-300 text-slate-600 hover:bg-slate-50"
          >
            Next week →
          </button>
          {weekOffset !== 0 && (
            <button
              onClick={() => setWeekOffset(0)}
              className="text-sm text-blue-600 hover:underline"
            >
              This week
            </button>
          )}
        </div>
        <div className="flex items-center gap-2">
          <label className="text-xs font-medium text-slate-600">Provider</label>
          <select
            value={providerId}
            onChange={(e) => setProviderId(e.target.value)}
            className="border border-slate-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">All providers</option>
            {providers.map((p) => (
              <option key={p.id} value={p.id}>{p.display_name}</option>
            ))}
          </select>
        </div>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12"><div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" /></div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-7 gap-3">
          {days.map((day, idx) => {
            const key = dateKey(day)
            const dayAppointments = byDay.get(key) ?? []
            const isToday = key === dateKey(new Date())
            return (
              <div key={key} className={`bg-white rounded-xl border ${isToday ? "border-blue-400 ring-1 ring-blue-200" : "border-slate-200"} p-3 flex flex-col min-h-[160px]`}>
                <div className="mb-2">
                  <p className="text-xs font-medium text-slate-500">{DAY_LABELS[idx]}</p>
                  <p className={`text-sm font-semibold ${isToday ? "text-blue-700" : "text-slate-800"}`}>
                    {day.toLocaleDateString([], { month: "short", day: "numeric" })}
                  </p>
                </div>
                <div className="flex flex-col gap-2 flex-1">
                  {dayAppointments.length === 0 ? (
                    <p className="text-xs text-slate-300 italic mt-2">No appointments</p>
                  ) : (
                    dayAppointments.map((a) => (
                      <Link
                        key={a.id}
                        href="/scheduling/appointments"
                        className="block rounded-lg border border-slate-100 hover:border-blue-200 hover:bg-blue-50/50 p-2 transition-colors"
                      >
                        <div className="flex items-center gap-1.5 mb-0.5">
                          <span className={`w-1.5 h-1.5 rounded-full ${STATUS_DOT[a.status] ?? "bg-slate-400"}`} />
                          <span className="text-xs font-medium text-slate-700">
                            {new Date(a.start_at).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}
                          </span>
                        </div>
                        <p className="text-xs text-slate-800 font-medium truncate">{a.client_name}</p>
                        <p className="text-[11px] text-slate-500 truncate">{a.provider_name} · {a.appointment_type_name}</p>
                      </Link>
                    ))
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

"use client"
import { useCallback, useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { ArrowLeft, ChevronDown, ChevronUp } from "lucide-react"
import { useAuthStore } from "@/store/auth"
import { api } from "@/lib/api"
import type { MyAppointment, MyAppointmentDetail, SchedulingConfig } from "@/lib/types"

const DEFAULT_TERMS: Record<string, string> = {
  appointment_singular: "Appointment",
  appointment_plural: "Appointments",
  provider_singular: "Provider",
  provider_plural: "Providers",
}

const STATUS_COLORS: Record<string, string> = {
  requested: "bg-yellow-50 text-yellow-700",
  confirmed: "bg-brand/10 text-brand-dark",
  completed: "bg-green-50 text-green-700",
  cancelled: "bg-red-50 text-red-700",
  no_show: "bg-slate-100 text-slate-500",
}

function isoDate(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, "0")
  const day = String(d.getDate()).padStart(2, "0")
  return `${y}-${m}-${day}`
}

function todayISODate(): string {
  return isoDate(new Date())
}

function tomorrowISODate(): string {
  const d = new Date()
  d.setDate(d.getDate() + 1)
  return isoDate(d)
}

function formatSlotTime(iso: string): string {
  try {
    return new Date(iso).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })
  } catch {
    return iso
  }
}

function formatDateTime(iso: string): string {
  try {
    return new Date(iso).toLocaleString([], {
      weekday: "short",
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    })
  } catch {
    return iso
  }
}

function canModify(appt: MyAppointment): boolean {
  if (appt.status !== "requested" && appt.status !== "confirmed") return false
  return new Date(appt.start_at).getTime() > Date.now()
}

export default function MyAppointmentsPage() {
  const user = useAuthStore((s) => s.user)
  const router = useRouter()

  const [config, setConfig] = useState<SchedulingConfig | null>(null)
  const [appointments, setAppointments] = useState<MyAppointment[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState("")

  // Cancel modal
  const [cancelId, setCancelId] = useState<string | null>(null)
  const [cancelReason, setCancelReason] = useState("")
  const [cancelSubmitting, setCancelSubmitting] = useState(false)
  const [cancelError, setCancelError] = useState("")

  // Reschedule panel
  const [rescheduleId, setRescheduleId] = useState<string | null>(null)
  const [rescheduleDetail, setRescheduleDetail] = useState<MyAppointmentDetail | null>(null)
  const [rescheduleDetailLoading, setRescheduleDetailLoading] = useState(false)
  const [rescheduleDetailError, setRescheduleDetailError] = useState("")
  const [rescheduleDate, setRescheduleDate] = useState(tomorrowISODate())
  const [rescheduleSlots, setRescheduleSlots] = useState<string[]>([])
  const [slotsLoading, setSlotsLoading] = useState(false)
  const [slotsError, setSlotsError] = useState("")
  const [rescheduleSubmitting, setRescheduleSubmitting] = useState(false)
  const [rescheduleActionError, setRescheduleActionError] = useState("")

  const term = (key: string, fallback: string) => config?.terms?.[key] || DEFAULT_TERMS[key] || fallback

  const loadAppointments = useCallback(async () => {
    setLoading(true)
    setLoadError("")
    try {
      const res = await api.get<{ items: MyAppointment[] }>("/api/scheduling/appointments?page_size=50")
      setAppointments(res?.items ?? [])
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : "Could not load your appointments.")
      setAppointments([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (!user) { router.push("/login?redirect=/account/appointments"); return }
    api.get<SchedulingConfig>("/api/scheduling/config").then(setConfig).catch(() => setConfig(null))
    api.get<{ items: MyAppointment[] }>("/api/scheduling/appointments?page_size=50")
      .then((r) => setAppointments(r?.items ?? []))
      .catch((err) => {
        setLoadError(err instanceof Error ? err.message : "Could not load your appointments.")
        setAppointments([])
      })
      .finally(() => setLoading(false))
  }, [user, router])

  // ── Cancel ──────────────────────────────────────────────────────────────────
  function openCancel(id: string) {
    setCancelId(id)
    setCancelReason("")
    setCancelError("")
  }

  function closeCancel() {
    setCancelId(null)
    setCancelReason("")
    setCancelError("")
  }

  async function confirmCancel() {
    if (!cancelId) return
    setCancelSubmitting(true)
    setCancelError("")
    try {
      const payload: Record<string, unknown> = {}
      if (cancelReason.trim()) payload.cancellation_reason = cancelReason.trim()
      await api.post(`/api/scheduling/appointments/${cancelId}/cancel`, payload)
      closeCancel()
      await loadAppointments()
    } catch (err) {
      setCancelError(err instanceof Error ? err.message : "Could not cancel this appointment. Please try again.")
    } finally {
      setCancelSubmitting(false)
    }
  }

  // ── Reschedule ──────────────────────────────────────────────────────────────
  async function loadRescheduleSlots(providerId: string, appointmentTypeId: string, forDate: string) {
    setSlotsLoading(true)
    setSlotsError("")
    try {
      const data = await api.get<{ slots: string[] }>(
        `/api/scheduling/availability?provider_id=${encodeURIComponent(providerId)}&appointment_type_id=${encodeURIComponent(appointmentTypeId)}&date_from=${forDate}&date_to=${forDate}`,
      )
      setRescheduleSlots(data?.slots ?? [])
    } catch (err) {
      setSlotsError(err instanceof Error ? err.message : "Could not load available times.")
      setRescheduleSlots([])
    } finally {
      setSlotsLoading(false)
    }
  }

  async function openReschedule(appt: MyAppointment) {
    setRescheduleId(appt.id)
    setRescheduleDetail(null)
    setRescheduleDetailError("")
    setRescheduleSlots([])
    setSlotsError("")
    setRescheduleActionError("")
    const defaultDate = tomorrowISODate()
    setRescheduleDate(defaultDate)
    setRescheduleDetailLoading(true)
    try {
      const detail = await api.get<MyAppointmentDetail>(`/api/scheduling/appointments/${appt.id}`)
      setRescheduleDetail(detail)
      await loadRescheduleSlots(detail.provider_id, detail.appointment_type_id, defaultDate)
    } catch (err) {
      setRescheduleDetailError(err instanceof Error ? err.message : "Could not load appointment details.")
    } finally {
      setRescheduleDetailLoading(false)
    }
  }

  function closeReschedule() {
    setRescheduleId(null)
    setRescheduleDetail(null)
    setRescheduleSlots([])
    setRescheduleActionError("")
  }

  function changeRescheduleDate(newDate: string) {
    setRescheduleDate(newDate)
    if (rescheduleDetail) loadRescheduleSlots(rescheduleDetail.provider_id, rescheduleDetail.appointment_type_id, newDate)
  }

  async function pickRescheduleSlot(slot: string) {
    if (!rescheduleId || !rescheduleDetail) return
    setRescheduleSubmitting(true)
    setRescheduleActionError("")
    try {
      await api.post(`/api/scheduling/appointments/${rescheduleId}/reschedule`, { start_at: slot })
      closeReschedule()
      await loadAppointments()
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Could not reschedule. Please try again."
      if (msg.toLowerCase().includes("no longer available")) {
        setRescheduleActionError("That time was just taken — please choose another time.")
        loadRescheduleSlots(rescheduleDetail.provider_id, rescheduleDetail.appointment_type_id, rescheduleDate)
      } else {
        setRescheduleActionError(msg)
      }
    } finally {
      setRescheduleSubmitting(false)
    }
  }

  if (!user || loading) return <div className="flex justify-center py-20 text-slate-400">Loading…</div>

  const now = new Date().getTime()
  const sorted = [...appointments].sort((a, b) => new Date(a.start_at).getTime() - new Date(b.start_at).getTime())
  const upcoming = sorted.filter((a) => new Date(a.start_at).getTime() >= now)
  const past = sorted.filter((a) => new Date(a.start_at).getTime() < now).reverse()

  function renderRow(appt: MyAppointment) {
    const colorClass = STATUS_COLORS[appt.status] ?? "bg-slate-50 text-slate-700"
    const showActions = canModify(appt)
    const isRescheduling = rescheduleId === appt.id

    return (
      <div key={appt.id} className="bg-white border border-slate-100 rounded-2xl overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4">
          <div>
            <p className="text-sm font-medium text-slate-900">{formatDateTime(appt.start_at)}</p>
            <p className="text-xs text-slate-400 mt-0.5">
              {[appt.appointment_type_name, appt.provider_name].filter(Boolean).join(" · ")}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${colorClass}`}>
              {appt.status.replace("_", " ")}
            </span>
            {showActions && (
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => (isRescheduling ? closeReschedule() : openReschedule(appt))}
                  className="text-xs font-medium text-brand-dark hover:underline flex items-center gap-0.5"
                >
                  Reschedule {isRescheduling ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                </button>
                <button
                  type="button"
                  onClick={() => openCancel(appt.id)}
                  className="text-xs font-medium text-alert hover:underline"
                >
                  Cancel
                </button>
              </div>
            )}
          </div>
        </div>

        {isRescheduling && (
          <div className="border-t border-slate-100 bg-slate-50 px-6 py-4">
            {rescheduleDetailLoading && <p className="text-sm text-slate-400">Loading details…</p>}
            {!rescheduleDetailLoading && rescheduleDetailError && (
              <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3 flex items-center justify-between">
                <span>{rescheduleDetailError}</span>
                <button onClick={() => openReschedule(appt)} className="underline font-medium">Try again</button>
              </div>
            )}
            {!rescheduleDetailLoading && !rescheduleDetailError && rescheduleDetail && (
              <div>
                <div className="mb-3">
                  <label className="block text-sm text-slate-600 mb-1">New date</label>
                  <input
                    type="date"
                    value={rescheduleDate}
                    min={todayISODate()}
                    onChange={(e) => changeRescheduleDate(e.target.value)}
                    className="border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-dark bg-white"
                  />
                </div>
                {rescheduleActionError && (
                  <div className="bg-red-50 border border-red-200 text-red-700 text-xs rounded-lg px-3 py-2 mb-3">
                    {rescheduleActionError}
                  </div>
                )}
                {slotsLoading && <p className="text-sm text-slate-400 py-4">Loading available times…</p>}
                {!slotsLoading && slotsError && (
                  <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3 flex items-center justify-between">
                    <span>{slotsError}</span>
                    <button
                      onClick={() => loadRescheduleSlots(rescheduleDetail.provider_id, rescheduleDetail.appointment_type_id, rescheduleDate)}
                      className="underline font-medium"
                    >
                      Try again
                    </button>
                  </div>
                )}
                {!slotsLoading && !slotsError && rescheduleSlots.length === 0 && (
                  <p className="text-sm text-slate-400 py-4">No open times on this day, try another date.</p>
                )}
                {!slotsLoading && !slotsError && rescheduleSlots.length > 0 && (
                  <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                    {rescheduleSlots.map((slot) => (
                      <button
                        key={slot}
                        type="button"
                        disabled={rescheduleSubmitting}
                        onClick={() => pickRescheduleSlot(slot)}
                        className="text-sm font-medium rounded-lg px-3 py-2 border border-slate-200 text-slate-700 hover:border-brand-dark bg-white transition-colors disabled:opacity-50"
                      >
                        {formatSlotTime(slot)}
                      </button>
                    ))}
                  </div>
                )}
                <button
                  type="button"
                  onClick={closeReschedule}
                  className="mt-4 text-xs text-slate-500 hover:text-slate-800"
                >
                  Close
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-10">
      <Link href="/account" className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-800 mb-6">
        <ArrowLeft size={14} /> Back to account
      </Link>
      <h1 className="text-2xl font-bold text-slate-900 mb-6">
        My {term("appointment_plural", "Appointments").toLowerCase()}
      </h1>

      {loadError && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3 flex items-center justify-between mb-6">
          <span>{loadError}</span>
          <button onClick={loadAppointments} className="underline font-medium">Try again</button>
        </div>
      )}

      {!loadError && appointments.length === 0 && (
        <div className="text-center py-20 text-slate-400">
          <p className="mb-4">You have no {term("appointment_plural", "appointments").toLowerCase()} yet</p>
          <Link href="/book" className="inline-block bg-brand hover:bg-brand-hover text-white px-6 py-2.5 rounded-lg text-sm transition-colors">
            Book a {term("appointment_singular", "appointment").toLowerCase()}
          </Link>
        </div>
      )}

      {!loadError && appointments.length > 0 && (
        <div className="space-y-8">
          {upcoming.length > 0 && (
            <div>
              <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-3">Upcoming</h2>
              <div className="space-y-3">{upcoming.map(renderRow)}</div>
            </div>
          )}
          {past.length > 0 && (
            <div>
              <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-3">Past</h2>
              <div className="space-y-3">{past.map(renderRow)}</div>
            </div>
          )}
        </div>
      )}

      {cancelId && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center px-4 z-50">
          <div className="bg-white rounded-2xl p-6 max-w-sm w-full">
            <h2 className="font-semibold text-slate-900 mb-2">
              Cancel this {term("appointment_singular", "appointment").toLowerCase()}?
            </h2>
            <p className="text-sm text-slate-500 mb-4">This cannot be undone.</p>
            <label className="block text-sm text-slate-600 mb-1">Reason (optional)</label>
            <textarea
              value={cancelReason}
              onChange={(e) => setCancelReason(e.target.value)}
              rows={3}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-dark mb-4"
            />
            {cancelError && <p className="text-sm text-alert mb-4">{cancelError}</p>}
            <div className="flex gap-3">
              <button
                type="button"
                disabled={cancelSubmitting}
                onClick={confirmCancel}
                className="flex-1 bg-alert hover:opacity-90 text-white font-medium py-2.5 rounded-lg transition-opacity disabled:opacity-50"
              >
                {cancelSubmitting ? "Cancelling…" : "Yes, cancel"}
              </button>
              <button
                type="button"
                onClick={closeCancel}
                className="flex-1 border border-slate-200 text-slate-700 py-2.5 rounded-lg hover:bg-slate-50 transition-colors"
              >
                Keep it
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

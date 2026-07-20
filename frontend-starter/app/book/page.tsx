"use client"
import { useEffect, useState } from "react"
import Link from "next/link"
import { CheckCircle, ChevronLeft } from "lucide-react"
import { useAuthStore } from "@/store/auth"
import { api } from "@/lib/api"
import { formatMoney } from "@/lib/currency"
import type {
  SchedulingConfig,
  BookableService,
  BookableProvider,
  AvailabilitySlots,
  BookingConfirmation,
} from "@/lib/types"

type Step = "service" | "provider" | "slot" | "details"

const DEFAULT_TERMS: Record<string, string> = {
  appointment_singular: "Appointment",
  appointment_plural: "Appointments",
  provider_singular: "Provider",
  provider_plural: "Providers",
  client_singular: "Client",
  client_plural: "Clients",
}

const STEPS: { key: Step; label: string }[] = [
  { key: "service", label: "Service" },
  { key: "provider", label: "Provider" },
  { key: "slot", label: "Date & Time" },
  { key: "details", label: "Your Details" },
]

function todayISODate(): string {
  const d = new Date()
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, "0")
  const day = String(d.getDate()).padStart(2, "0")
  return `${y}-${m}-${day}`
}

function formatSlotTime(iso: string): string {
  try {
    return new Date(iso).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })
  } catch {
    return iso
  }
}

function formatSlotDateTime(iso: string): string {
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

interface GuestForm {
  first_name: string
  last_name: string
  email: string
  phone: string
}

export default function BookPage() {
  const user = useAuthStore((s) => s.user)

  const [config, setConfig] = useState<SchedulingConfig | null>(null)

  const [step, setStep] = useState<Step>("service")

  // Services
  const [services, setServices] = useState<BookableService[]>([])
  const [servicesLoading, setServicesLoading] = useState(true)
  const [servicesError, setServicesError] = useState("")
  const [selectedService, setSelectedService] = useState<BookableService | null>(null)

  // Providers
  const [providers, setProviders] = useState<BookableProvider[]>([])
  const [providersLoading, setProvidersLoading] = useState(false)
  const [providersError, setProvidersError] = useState("")
  const [selectedProvider, setSelectedProvider] = useState<BookableProvider | null>(null)

  // Date & slots
  const [date, setDate] = useState(todayISODate())
  const [slots, setSlots] = useState<string[]>([])
  const [slotsLoading, setSlotsLoading] = useState(false)
  const [slotsError, setSlotsError] = useState("")
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null)

  // Details
  const [guest, setGuest] = useState<GuestForm>({ first_name: "", last_name: "", email: "", phone: "" })
  const [reason, setReason] = useState("")

  // Booking
  const [booking, setBooking] = useState(false)
  const [bookError, setBookError] = useState("")
  const [confirmed, setConfirmed] = useState<BookingConfirmation | null>(null)

  const term = (key: string, fallback: string) => config?.terms?.[key] || DEFAULT_TERMS[key] || fallback

  // Load config (non-fatal — falls back to defaults) + services (fatal if it fails)
  useEffect(() => {
    api.get<SchedulingConfig>("/api/scheduling/config")
      .then(setConfig)
      .catch(() => setConfig(null))
    loadServices()
  }, [])

  async function loadServices() {
    setServicesLoading(true)
    setServicesError("")
    try {
      const data = await api.get<BookableService[]>("/api/scheduling/public/appointment-types")
      setServices((data ?? []).filter((s) => s.is_active))
    } catch (err) {
      setServicesError(err instanceof Error ? err.message : "Could not load services.")
    } finally {
      setServicesLoading(false)
    }
  }

  async function loadProviders(appointmentTypeId: string) {
    setProvidersLoading(true)
    setProvidersError("")
    try {
      const data = await api.get<BookableProvider[]>(
        `/api/scheduling/public/providers?appointment_type_id=${encodeURIComponent(appointmentTypeId)}`,
      )
      setProviders((data ?? []).filter((p) => p.is_active))
    } catch (err) {
      setProvidersError(err instanceof Error ? err.message : "Could not load providers.")
    } finally {
      setProvidersLoading(false)
    }
  }

  async function loadSlots(providerId: string, appointmentTypeId: string, forDate: string) {
    setSlotsLoading(true)
    setSlotsError("")
    try {
      const data = await api.get<AvailabilitySlots>(
        `/api/scheduling/availability?provider_id=${encodeURIComponent(providerId)}&appointment_type_id=${encodeURIComponent(appointmentTypeId)}&date_from=${forDate}&date_to=${forDate}`,
      )
      setSlots(data?.slots ?? [])
    } catch (err) {
      setSlotsError(err instanceof Error ? err.message : "Could not load available times.")
      setSlots([])
    } finally {
      setSlotsLoading(false)
    }
  }

  function selectService(svc: BookableService) {
    setSelectedService(svc)
    setSelectedProvider(null)
    setSelectedSlot(null)
    setSlots([])
    setProviders([])
    setStep("provider")
    loadProviders(svc.id)
  }

  function selectProvider(p: BookableProvider) {
    setSelectedProvider(p)
    setSelectedSlot(null)
    setSlots([])
    setStep("slot")
    if (selectedService) loadSlots(p.id, selectedService.id, date)
  }

  function selectSlot(slot: string) {
    setSelectedSlot(slot)
    setStep("details")
  }

  function changeDate(newDate: string) {
    setDate(newDate)
    setSelectedSlot(null)
    if (selectedProvider && selectedService) loadSlots(selectedProvider.id, selectedService.id, newDate)
  }

  function goBackTo(target: Step) {
    setBookError("")
    setStep(target)
  }

  function resetBooking() {
    setSelectedService(null)
    setSelectedProvider(null)
    setSelectedSlot(null)
    setSlots([])
    setProviders([])
    setGuest({ first_name: "", last_name: "", email: "", phone: "" })
    setReason("")
    setBookError("")
    setConfirmed(null)
    setDate(todayISODate())
    setStep("service")
  }

  const canBook = !!selectedProvider && !!selectedService && !!selectedSlot &&
    (!!user || (guest.first_name.trim() && guest.last_name.trim() && guest.email.trim().includes("@")))

  async function handleBook() {
    if (!selectedProvider || !selectedService || !selectedSlot) return
    setBooking(true)
    setBookError("")
    try {
      const payload: Record<string, unknown> = {
        provider_id: selectedProvider.id,
        appointment_type_id: selectedService.id,
        start_at: selectedSlot,
      }
      if (reason.trim()) payload.reason = reason.trim()
      if (!user) {
        payload.first_name = guest.first_name.trim()
        payload.last_name = guest.last_name.trim()
        payload.email = guest.email.trim()
        if (guest.phone.trim()) payload.phone = guest.phone.trim()
      }
      const res = await api.post<BookingConfirmation>("/api/scheduling/appointments", payload)
      setConfirmed(res)
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Booking failed. Please try again."
      if (msg.toLowerCase().includes("no longer available")) {
        setBookError("That time slot was just taken by someone else — please choose another time.")
        setSelectedSlot(null)
        setStep("slot")
        if (selectedProvider && selectedService) loadSlots(selectedProvider.id, selectedService.id, date)
      } else {
        setBookError(msg)
      }
    } finally {
      setBooking(false)
    }
  }

  // ── Success state ──────────────────────────────────────────────────────────
  if (confirmed) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center px-4 py-16">
        <div className="max-w-md w-full text-center">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <CheckCircle className="text-green-600" size={32} />
          </div>
          <h1 className="text-2xl font-bold text-slate-900 mb-2">
            Your {term("appointment_singular", "Appointment").toLowerCase()} is confirmed!
          </h1>
          <div className="bg-card-bg border border-slate-100 rounded-xl p-5 mt-6 text-left space-y-1.5">
            <p className="text-sm text-slate-600">
              <span className="font-medium text-slate-900">{confirmed.appointment_type_name ?? selectedService?.name}</span>
            </p>
            <p className="text-sm text-slate-600">
              {term("provider_singular", "Provider")}: {confirmed.provider_name ?? selectedProvider?.display_name}
            </p>
            <p className="text-sm text-slate-600">{formatSlotDateTime(confirmed.start_at)}</p>
          </div>
          <div className="flex gap-3 justify-center mt-8">
            <Link href="/"
              className="px-5 py-2.5 border border-slate-200 text-slate-700 rounded-xl text-sm hover:bg-slate-50 transition-colors">
              Back to home
            </Link>
            <button
              type="button"
              onClick={resetBooking}
              className="px-5 py-2.5 bg-brand hover:bg-brand-hover text-on-brand rounded-xl text-sm transition-colors"
            >
              Book another
            </button>
          </div>
        </div>
      </div>
    )
  }

  const currentIndex = STEPS.findIndex((s) => s.key === step)

  return (
    <div className="max-w-3xl mx-auto px-4 py-10">
      <h1 className="text-2xl font-bold text-slate-900 mb-2">
        Book a {term("appointment_singular", "Appointment").toLowerCase()}
      </h1>
      <p className="text-slate-500 text-sm mb-8">
        Choose a service, {term("provider_singular", "provider").toLowerCase()}, and time that works for you.
      </p>

      {/* Stepper */}
      <div className="flex items-center mb-10">
        {STEPS.map((s, i) => {
          const isDone = i < currentIndex
          const isCurrent = i === currentIndex
          const clickable = i < currentIndex
          return (
            <div key={s.key} className="flex items-center flex-1 last:flex-none">
              <button
                type="button"
                disabled={!clickable}
                onClick={() => clickable && goBackTo(s.key)}
                className={`flex items-center gap-2 ${clickable ? "cursor-pointer" : "cursor-default"}`}
              >
                <span
                  className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold flex-shrink-0 ${
                    isDone
                      ? "bg-brand text-on-brand"
                      : isCurrent
                        ? "bg-emphasis-surface text-white"
                        : "bg-slate-100 text-slate-400"
                  }`}
                >
                  {isDone ? <CheckCircle size={14} /> : i + 1}
                </span>
                <span className={`text-xs font-medium hidden sm:inline ${isCurrent ? "text-slate-900" : "text-slate-400"}`}>
                  {s.label}
                </span>
              </button>
              {i < STEPS.length - 1 && <div className="flex-1 h-px bg-slate-200 mx-3" />}
            </div>
          )
        })}
      </div>

      {/* Step 1: Service */}
      {step === "service" && (
        <div>
          {servicesLoading && <p className="text-slate-400 text-sm py-8 text-center">Loading services…</p>}
          {!servicesLoading && servicesError && (
            <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3 flex items-center justify-between">
              <span>{servicesError}</span>
              <button onClick={loadServices} className="underline font-medium">Try again</button>
            </div>
          )}
          {!servicesLoading && !servicesError && services.length === 0 && (
            <p className="text-slate-400 text-sm py-8 text-center">No services are available to book right now.</p>
          )}
          {!servicesLoading && !servicesError && services.length > 0 && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {services.map((svc) => (
                <button
                  key={svc.id}
                  type="button"
                  onClick={() => selectService(svc)}
                  className={`text-left bg-card-bg border rounded-xl p-5 transition-colors hover:border-brand-dark ${
                    selectedService?.id === svc.id ? "border-brand-dark bg-brand/5" : "border-slate-200"
                  }`}
                >
                  <p className="font-semibold text-slate-900">{svc.name}</p>
                  <p className="text-xs text-slate-500 mt-1">{svc.duration_minutes} min</p>
                  {svc.description && <p className="text-sm text-slate-600 mt-2">{svc.description}</p>}
                  {svc.price != null && svc.price !== "" && (
                    <p className="text-sm font-medium text-brand-dark mt-2">{formatMoney(svc.price)}</p>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Step 2: Provider */}
      {step === "provider" && (
        <div>
          <button onClick={() => goBackTo("service")} className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-800 mb-4">
            <ChevronLeft size={14} /> Change service
          </button>
          <h2 className="font-semibold text-slate-900 mb-4">Choose a {term("provider_singular", "provider").toLowerCase()}</h2>
          {providersLoading && <p className="text-slate-400 text-sm py-8 text-center">Loading {term("provider_plural", "providers").toLowerCase()}…</p>}
          {!providersLoading && providersError && (
            <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3 flex items-center justify-between">
              <span>{providersError}</span>
              <button onClick={() => selectedService && loadProviders(selectedService.id)} className="underline font-medium">Try again</button>
            </div>
          )}
          {!providersLoading && !providersError && providers.length === 0 && (
            <p className="text-slate-400 text-sm py-8 text-center">
              No {term("provider_plural", "providers").toLowerCase()} are currently available for this service.
            </p>
          )}
          {!providersLoading && !providersError && providers.length > 0 && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {providers.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => selectProvider(p)}
                  className={`text-left bg-card-bg border rounded-xl p-5 transition-colors hover:border-brand-dark ${
                    selectedProvider?.id === p.id ? "border-brand-dark bg-brand/5" : "border-slate-200"
                  }`}
                >
                  <p className="font-semibold text-slate-900">{p.display_name}</p>
                  {(p.title || p.specialty) && (
                    <p className="text-xs text-slate-500 mt-1">{[p.title, p.specialty].filter(Boolean).join(" · ")}</p>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Step 3: Date & slot */}
      {step === "slot" && (
        <div>
          <button onClick={() => goBackTo("provider")} className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-800 mb-4">
            <ChevronLeft size={14} /> Change {term("provider_singular", "provider").toLowerCase()}
          </button>
          <h2 className="font-semibold text-slate-900 mb-4">Choose a date &amp; time</h2>
          <div className="mb-5">
            <label className="block text-sm text-slate-600 mb-1">Date</label>
            <input
              type="date"
              value={date}
              min={todayISODate()}
              onChange={(e) => changeDate(e.target.value)}
              className="border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-dark"
            />
          </div>
          {slotsLoading && <p className="text-slate-400 text-sm py-8 text-center">Loading available times…</p>}
          {!slotsLoading && slotsError && (
            <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3 flex items-center justify-between">
              <span>{slotsError}</span>
              <button
                onClick={() => selectedProvider && selectedService && loadSlots(selectedProvider.id, selectedService.id, date)}
                className="underline font-medium"
              >
                Try again
              </button>
            </div>
          )}
          {!slotsLoading && !slotsError && slots.length === 0 && (
            <p className="text-slate-400 text-sm py-8 text-center">No open times on this day, try another date.</p>
          )}
          {!slotsLoading && !slotsError && slots.length > 0 && (
            <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
              {slots.map((slot) => (
                <button
                  key={slot}
                  type="button"
                  onClick={() => selectSlot(slot)}
                  className={`text-sm font-medium rounded-lg px-3 py-2.5 border transition-colors ${
                    selectedSlot === slot
                      ? "border-brand-dark bg-emphasis-surface text-white"
                      : "border-slate-200 text-slate-700 hover:border-brand-dark"
                  }`}
                >
                  {formatSlotTime(slot)}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Step 4: Details + confirm */}
      {step === "details" && selectedService && selectedProvider && selectedSlot && (
        <div>
          <button onClick={() => goBackTo("slot")} className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-800 mb-4">
            <ChevronLeft size={14} /> Change time
          </button>

          <div className="bg-card-bg border border-slate-100 rounded-xl p-6 mb-6">
            <h2 className="font-semibold text-slate-900 mb-4">Your details</h2>
            {user ? (
              <p className="text-sm text-slate-600">
                Booking as <span className="font-medium text-slate-900">{user.first_name} {user.last_name}</span> ({user.email})
              </p>
            ) : (
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm text-slate-600 mb-1">First name *</label>
                    <input
                      required
                      value={guest.first_name}
                      onChange={(e) => setGuest((g) => ({ ...g, first_name: e.target.value }))}
                      className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-dark"
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-slate-600 mb-1">Last name *</label>
                    <input
                      required
                      value={guest.last_name}
                      onChange={(e) => setGuest((g) => ({ ...g, last_name: e.target.value }))}
                      className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-dark"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm text-slate-600 mb-1">Email *</label>
                  <input
                    required
                    type="email"
                    value={guest.email}
                    onChange={(e) => setGuest((g) => ({ ...g, email: e.target.value }))}
                    placeholder="you@example.com"
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-dark"
                  />
                </div>
                <div>
                  <label className="block text-sm text-slate-600 mb-1">Phone (optional)</label>
                  <input
                    value={guest.phone}
                    onChange={(e) => setGuest((g) => ({ ...g, phone: e.target.value }))}
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-dark"
                  />
                </div>
                <p className="text-xs text-slate-400">
                  Already have an account?{" "}
                  <Link href="/login?redirect=/book" className="text-brand-dark hover:underline">Sign in</Link>
                </p>
              </div>
            )}
            <div className="mt-4">
              <label className="block text-sm text-slate-600 mb-1">Reason for visit (optional)</label>
              <textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                rows={3}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-dark"
              />
            </div>
          </div>

          <div className="bg-card-bg border border-slate-100 rounded-xl p-6">
            <h2 className="font-semibold text-slate-900 mb-4">Summary</h2>
            <div className="space-y-1.5 text-sm text-slate-600 mb-6">
              <p><span className="text-slate-900 font-medium">{selectedService.name}</span> ({selectedService.duration_minutes} min)</p>
              <p>{term("provider_singular", "Provider")}: {selectedProvider.display_name}</p>
              <p>{formatSlotDateTime(selectedSlot)}</p>
              {selectedService.price != null && selectedService.price !== "" && (
                <p>Price: {formatMoney(selectedService.price)}</p>
              )}
            </div>
            {bookError && <div className="bg-red-50 border border-red-200 text-red-700 text-xs rounded-lg px-3 py-2 mb-4">{bookError}</div>}
            <button
              type="button"
              disabled={!canBook || booking}
              onClick={handleBook}
              className="w-full bg-brand hover:bg-brand-hover text-on-brand font-semibold py-3 rounded-xl transition-colors disabled:opacity-50"
            >
              {booking ? "Booking…" : `Book ${term("appointment_singular", "Appointment").toLowerCase()}`}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

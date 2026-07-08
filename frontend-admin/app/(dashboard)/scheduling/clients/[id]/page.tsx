"use client"
import { useEffect, useState, use } from "react"
import { useRouter } from "next/navigation"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { api } from "@/lib/api"
import type {
  SchedulingClient,
  SchedulingConfig,
  SchedulingConfigField,
  Paginated,
  SchedulingAppointmentList,
  SchedulingJournalEntryList,
  SchedulingJournalEntry,
} from "@/lib/types"
import { PageHeader } from "@/components/page-header"
import { StatusBadge } from "@/components/status-badge"
import { ChevronDown, ChevronUp } from "lucide-react"

const input = "w-full border border-slate-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"

type ApiError = Error & { status?: number }

function isForbidden(err: unknown): boolean {
  return err instanceof Error && (err as ApiError).status === 403
}

function IntakeFieldInput({
  field,
  value,
  onChange,
}: {
  field: SchedulingConfigField
  value: string
  onChange: (v: string) => void
}) {
  switch (field.type) {
    case "textarea":
      return <textarea value={value} onChange={(e) => onChange(e.target.value)} className={`${input} h-20 resize-none`} />
    case "number":
      return <input type="number" value={value} onChange={(e) => onChange(e.target.value)} className={input} />
    case "date":
      return <input type="date" value={value} onChange={(e) => onChange(e.target.value)} className={input} />
    case "checkbox":
    case "boolean":
      return (
        <label className="flex items-center gap-2 text-sm text-slate-700">
          <input
            type="checkbox"
            checked={value === "true"}
            onChange={(e) => onChange(e.target.checked ? "true" : "false")}
          />
          Yes
        </label>
      )
    default:
      return <input type="text" value={value} onChange={(e) => onChange(e.target.value)} className={input} />
  }
}

function formatDateTime(iso: string) {
  const d = new Date(iso)
  if (isNaN(d.getTime())) return iso
  return d.toLocaleString([], { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" })
}

// ── Page entry (typed dynamic route param, per this Next.js version's convention) ──
export default function ClientDetailPage(props: PageProps<"/scheduling/clients/[id]">) {
  const { id } = use(props.params)
  return <ClientDetail id={id} />
}

function ClientDetail({ id }: { id: string }) {
  const router = useRouter()
  const qc = useQueryClient()

  const { data: config } = useQuery<SchedulingConfig>({
    queryKey: ["scheduling-config"],
    queryFn: () => api.get("/api/scheduling/config"),
  })
  const terms = config?.terms ?? {}
  const clientSingular = terms.client_singular || "Client"
  const journalSingular = terms.journal_singular || "Clinical Notes"
  const intakeSchema = config?.intake_schema ?? []
  const noteTemplate = config?.note_template

  const { data: client, isLoading } = useQuery<SchedulingClient>({
    queryKey: ["scheduling-client", id],
    queryFn: () => api.get(`/api/scheduling/clients/${id}`),
  })

  // ── Demographics + intake ──────────────────────────────────────────────────
  const [editingDemo, setEditingDemo] = useState(false)
  const [demoForm, setDemoForm] = useState({
    first_name: "", last_name: "", email: "", phone: "", date_of_birth: "", is_active: true,
  })
  const [customFields, setCustomFields] = useState<Record<string, string>>({})
  const [demoError, setDemoError] = useState("")

  useEffect(() => {
    if (client) {
      setDemoForm({
        first_name: client.first_name,
        last_name: client.last_name,
        email: client.email ?? "",
        phone: client.phone ?? "",
        date_of_birth: client.date_of_birth ?? "",
        is_active: client.is_active,
      })
      const cf: Record<string, string> = {}
      for (const f of intakeSchema) {
        const v = client.custom_fields?.[f.key]
        cf[f.key] = v === undefined || v === null ? "" : String(v)
      }
      setCustomFields(cf)
    }
    // Re-seed whenever the client record or intake schema changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [client, intakeSchema.length])

  const updateDemo = useMutation({
    mutationFn: (d: typeof demoForm) =>
      api.patch<SchedulingClient>(`/api/scheduling/clients/${id}`, {
        first_name: d.first_name,
        last_name: d.last_name,
        email: d.email || undefined,
        phone: d.phone || undefined,
        date_of_birth: d.date_of_birth || undefined,
        is_active: d.is_active,
        custom_fields: customFields,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["scheduling-client", id] })
      qc.invalidateQueries({ queryKey: ["scheduling-clients-list"] })
      setEditingDemo(false)
      setDemoError("")
    },
    onError: (e) => setDemoError(e instanceof Error ? e.message : "Failed to save"),
  })

  // ── Appointment history ────────────────────────────────────────────────────
  const { data: apptData, isLoading: apptLoading } = useQuery<Paginated<SchedulingAppointmentList>>({
    queryKey: ["scheduling-client-appointments", id],
    queryFn: () => api.get(`/api/scheduling/appointments?client_id=${id}&page_size=50`),
  })
  const appointments = apptData?.items ?? []

  // ── Journal (clinical notes) ───────────────────────────────────────────────
  const journalList = useQuery<SchedulingJournalEntryList[]>({
    queryKey: ["scheduling-journal", id],
    queryFn: () => api.get(`/api/scheduling/clients/${id}/journal`),
    retry: false,
  })
  const journalForbidden = isForbidden(journalList.error)
  const entries = [...(journalList.data ?? [])].sort((a, b) => b.created_at.localeCompare(a.created_at))

  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [entryEditing, setEntryEditing] = useState(false)
  const [entryEditContent, setEntryEditContent] = useState<Record<string, string>>({})
  const [entryError, setEntryError] = useState("")

  const expandedEntry = useQuery<SchedulingJournalEntry>({
    queryKey: ["scheduling-journal-entry", expandedId],
    queryFn: () => api.get(`/api/scheduling/journal/${expandedId}`),
    enabled: !!expandedId,
    retry: false,
  })

  function toggleExpand(entryId: string) {
    setEntryEditing(false)
    setEntryError("")
    setExpandedId((cur) => (cur === entryId ? null : entryId))
  }

  function startEntryEdit() {
    const content = expandedEntry.data?.content ?? {}
    const seeded: Record<string, string> = {}
    const fields = noteTemplate?.fields ?? []
    for (const f of fields) {
      const v = content[f.key]
      seeded[f.key] = v === undefined || v === null ? "" : String(v)
    }
    // preserve any extra keys not in the current template definition
    for (const k of Object.keys(content)) {
      if (!(k in seeded)) seeded[k] = String(content[k] ?? "")
    }
    setEntryEditContent(seeded)
    setEntryEditing(true)
    setEntryError("")
  }

  const updateEntry = useMutation({
    mutationFn: (contentToSave: Record<string, string>) =>
      api.patch<SchedulingJournalEntry>(`/api/scheduling/journal/${expandedId}`, { content: contentToSave }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["scheduling-journal-entry", expandedId] })
      setEntryEditing(false)
      setEntryError("")
    },
    onError: (e) => setEntryError(e instanceof Error ? e.message : "Failed to save note"),
  })

  // ── New note form ──────────────────────────────────────────────────────────
  const [showNewNote, setShowNewNote] = useState(false)
  const [newNoteContent, setNewNoteContent] = useState<Record<string, string>>({})
  const [newNoteAppointmentId, setNewNoteAppointmentId] = useState("")
  const [newNoteError, setNewNoteError] = useState("")

  const createNote = useMutation({
    mutationFn: () =>
      api.post<SchedulingJournalEntry>(`/api/scheduling/clients/${id}/journal`, {
        template: noteTemplate?.name,
        content: newNoteContent,
        appointment_id: newNoteAppointmentId || undefined,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["scheduling-journal", id] })
      setShowNewNote(false)
      setNewNoteContent({})
      setNewNoteAppointmentId("")
      setNewNoteError("")
    },
    onError: (e) => setNewNoteError(e instanceof Error ? e.message : "Failed to create note"),
  })

  if (isLoading) {
    return (
      <div className="flex justify-center py-12">
        <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (!client) {
    return <p className="text-slate-500">{clientSingular} not found.</p>
  }

  return (
    <div className="max-w-3xl space-y-6">
      <PageHeader
        title={`${client.first_name} ${client.last_name}`}
        description={clientSingular}
        actionNode={
          <button onClick={() => router.push("/scheduling/clients")}
            className="text-sm text-slate-500 hover:text-slate-700 underline">
            Back to list
          </button>
        }
      />

      {/* ── Demographics + intake ─────────────────────────────────────────── */}
      <section className="bg-white rounded-xl border border-slate-200 p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold text-slate-700">Demographics</h3>
          {!editingDemo ? (
            <button onClick={() => setEditingDemo(true)} className="text-sm text-blue-600 hover:underline">Edit</button>
          ) : (
            <button onClick={() => { setEditingDemo(false); setDemoError("") }} className="text-sm text-slate-500 hover:underline">Cancel</button>
          )}
        </div>

        {!editingDemo ? (
          <div className="grid grid-cols-2 gap-4 text-sm">
            <Field label="First name">{client.first_name}</Field>
            <Field label="Last name">{client.last_name}</Field>
            <Field label="Email">{client.email || "—"}</Field>
            <Field label="Phone">{client.phone || "—"}</Field>
            <Field label="Date of birth">{client.date_of_birth || "—"}</Field>
            <Field label="Status"><StatusBadge value={client.is_active ? "active" : "inactive"} /></Field>
            {intakeSchema.map((f) => (
              <Field key={f.key} label={f.label}>
                {client.custom_fields?.[f.key] !== undefined && client.custom_fields?.[f.key] !== null && client.custom_fields?.[f.key] !== ""
                  ? String(client.custom_fields[f.key])
                  : "—"}
              </Field>
            ))}
          </div>
        ) : (
          <form onSubmit={(e) => { e.preventDefault(); updateDemo.mutate(demoForm) }} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">First name *</label>
                <input required value={demoForm.first_name}
                  onChange={(e) => setDemoForm((f) => ({ ...f, first_name: e.target.value }))} className={input} />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Last name *</label>
                <input required value={demoForm.last_name}
                  onChange={(e) => setDemoForm((f) => ({ ...f, last_name: e.target.value }))} className={input} />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Email</label>
                <input type="email" value={demoForm.email}
                  onChange={(e) => setDemoForm((f) => ({ ...f, email: e.target.value }))} className={input} />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Phone</label>
                <input value={demoForm.phone}
                  onChange={(e) => setDemoForm((f) => ({ ...f, phone: e.target.value }))} className={input} />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Date of birth</label>
                <input type="date" value={demoForm.date_of_birth}
                  onChange={(e) => setDemoForm((f) => ({ ...f, date_of_birth: e.target.value }))} className={input} />
              </div>
              <label className="flex items-center gap-2 text-sm text-slate-700 pt-5">
                <input type="checkbox" checked={demoForm.is_active}
                  onChange={(e) => setDemoForm((f) => ({ ...f, is_active: e.target.checked }))} />
                Active
              </label>
            </div>

            {intakeSchema.length > 0 && (
              <div className="border-t border-slate-100 pt-4">
                <p className="text-xs font-semibold text-slate-500 uppercase mb-3">Intake information</p>
                <div className="grid grid-cols-2 gap-4">
                  {intakeSchema.map((f) => (
                    <div key={f.key}>
                      <label className="block text-xs font-medium text-slate-600 mb-1">{f.label}</label>
                      <IntakeFieldInput
                        field={f}
                        value={customFields[f.key] ?? ""}
                        onChange={(v) => setCustomFields((prev) => ({ ...prev, [f.key]: v }))}
                      />
                    </div>
                  ))}
                </div>
              </div>
            )}

            {demoError && <p className="text-sm text-red-600">{demoError}</p>}
            <button type="submit" disabled={updateDemo.isPending}
              className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm disabled:opacity-50">
              {updateDemo.isPending ? "Saving…" : "Save changes"}
            </button>
          </form>
        )}
      </section>

      {/* ── Appointment history ───────────────────────────────────────────── */}
      <section className="bg-white rounded-xl border border-slate-200 p-6">
        <h3 className="text-sm font-semibold text-slate-700 mb-4">Appointment history</h3>
        {apptLoading ? (
          <div className="flex justify-center py-6"><div className="w-5 h-5 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" /></div>
        ) : appointments.length === 0 ? (
          <p className="text-sm text-slate-400">No appointments yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200">
                  {["Date / time", "Provider", "Type", "Status"].map((h) => (
                    <th key={h} className="text-left py-2 pr-4 font-medium text-slate-600">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {appointments.map((a) => (
                  <tr key={a.id}>
                    <td className="py-2 pr-4 text-slate-700 whitespace-nowrap">{formatDateTime(a.start_at)}</td>
                    <td className="py-2 pr-4 text-slate-600">{a.provider_name}</td>
                    <td className="py-2 pr-4 text-slate-600">{a.appointment_type_name}</td>
                    <td className="py-2"><StatusBadge value={a.status} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* ── Journal / clinical notes ──────────────────────────────────────── */}
      <section className="bg-white rounded-xl border border-slate-200 p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold text-slate-700">{journalSingular}</h3>
          {!journalForbidden && noteTemplate && (
            <button onClick={() => { setShowNewNote((v) => !v); setNewNoteError("") }} className="text-sm text-blue-600 hover:underline">
              {showNewNote ? "Cancel" : "+ New note"}
            </button>
          )}
        </div>

        {journalForbidden ? (
          <p className="text-sm text-slate-400 italic bg-slate-50 border border-slate-200 rounded-lg px-4 py-3">
            You don&rsquo;t have access to this {clientSingular.toLowerCase()}&rsquo;s clinical notes.
          </p>
        ) : journalList.isLoading ? (
          <div className="flex justify-center py-6"><div className="w-5 h-5 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" /></div>
        ) : journalList.isError ? (
          <p className="text-sm text-red-600">Failed to load notes.</p>
        ) : (
          <div className="space-y-4">
            {showNewNote && noteTemplate && (
              <form
                onSubmit={(e) => { e.preventDefault(); createNote.mutate() }}
                className="bg-slate-50 border border-slate-200 rounded-lg p-4 space-y-3"
              >
                {appointments.length > 0 && (
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">Link to appointment (optional)</label>
                    <select value={newNoteAppointmentId} onChange={(e) => setNewNoteAppointmentId(e.target.value)} className={input}>
                      <option value="">None</option>
                      {appointments.map((a) => (
                        <option key={a.id} value={a.id}>
                          {formatDateTime(a.start_at)} — {a.appointment_type_name} ({a.provider_name})
                        </option>
                      ))}
                    </select>
                  </div>
                )}
                {noteTemplate.fields.map((f) => (
                  <div key={f.key}>
                    <label className="block text-xs font-medium text-slate-600 mb-1">{f.label}</label>
                    <textarea
                      value={newNoteContent[f.key] ?? ""}
                      onChange={(e) => setNewNoteContent((prev) => ({ ...prev, [f.key]: e.target.value }))}
                      className={`${input} h-20 resize-none`}
                    />
                  </div>
                ))}
                {newNoteError && <p className="text-sm text-red-600">{newNoteError}</p>}
                <button type="submit" disabled={createNote.isPending}
                  className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm disabled:opacity-50">
                  {createNote.isPending ? "Saving…" : "Save note"}
                </button>
              </form>
            )}

            {entries.length === 0 ? (
              <p className="text-sm text-slate-400">No notes recorded yet.</p>
            ) : (
              <div className="divide-y divide-slate-100 border border-slate-200 rounded-lg overflow-hidden">
                {entries.map((entry) => {
                  const isOpen = expandedId === entry.id
                  return (
                    <div key={entry.id}>
                      <button
                        onClick={() => toggleExpand(entry.id)}
                        className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-slate-50"
                      >
                        <div>
                          <p className="text-sm font-medium text-slate-800">
                            {noteTemplate?.name === entry.template ? noteTemplate.label : entry.template}
                          </p>
                          <p className="text-xs text-slate-500">{formatDateTime(entry.created_at)}</p>
                        </div>
                        {isOpen ? <ChevronUp size={16} className="text-slate-400" /> : <ChevronDown size={16} className="text-slate-400" />}
                      </button>

                      {isOpen && (
                        <div className="px-4 py-4 bg-slate-50 border-t border-slate-100">
                          {expandedEntry.isLoading ? (
                            <div className="flex justify-center py-4"><div className="w-5 h-5 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" /></div>
                          ) : isForbidden(expandedEntry.error) ? (
                            <p className="text-sm text-slate-400 italic">You don&rsquo;t have access to this note.</p>
                          ) : expandedEntry.isError || !expandedEntry.data ? (
                            <p className="text-sm text-red-600">Failed to load note.</p>
                          ) : !entryEditing ? (
                            <div className="space-y-3">
                              {(noteTemplate?.fields ?? []).map((f) => (
                                <div key={f.key}>
                                  <p className="text-xs font-semibold text-slate-500 uppercase mb-1">{f.label}</p>
                                  <p className="text-sm text-slate-700 whitespace-pre-wrap">
                                    {expandedEntry.data!.content?.[f.key] !== undefined && expandedEntry.data!.content?.[f.key] !== null
                                      ? String(expandedEntry.data!.content[f.key])
                                      : "—"}
                                  </p>
                                </div>
                              ))}
                              <button onClick={startEntryEdit} className="text-sm text-blue-600 hover:underline">Edit</button>
                            </div>
                          ) : (
                            <form
                              onSubmit={(e) => { e.preventDefault(); updateEntry.mutate(entryEditContent) }}
                              className="space-y-3"
                            >
                              {(noteTemplate?.fields ?? []).map((f) => (
                                <div key={f.key}>
                                  <label className="block text-xs font-medium text-slate-600 mb-1">{f.label}</label>
                                  <textarea
                                    value={entryEditContent[f.key] ?? ""}
                                    onChange={(e) => setEntryEditContent((prev) => ({ ...prev, [f.key]: e.target.value }))}
                                    className={`${input} h-20 resize-none bg-white`}
                                  />
                                </div>
                              ))}
                              {entryError && <p className="text-sm text-red-600">{entryError}</p>}
                              <div className="flex gap-3">
                                <button type="submit" disabled={updateEntry.isPending}
                                  className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-1.5 rounded-lg text-sm disabled:opacity-50">
                                  {updateEntry.isPending ? "Saving…" : "Save"}
                                </button>
                                <button type="button" onClick={() => { setEntryEditing(false); setEntryError("") }}
                                  className="px-4 py-1.5 text-sm border border-slate-300 rounded-lg text-slate-600">
                                  Cancel
                                </button>
                              </div>
                            </form>
                          )}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}
      </section>
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-xs font-medium text-slate-500">{label}</p>
      <p className="text-slate-800">{children}</p>
    </div>
  )
}

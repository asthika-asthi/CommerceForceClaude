"use client"
import { useEffect, useState } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import Link from "next/link"
import { api } from "@/lib/api"
import type { Paginated, SchedulingClientList, SchedulingConfig, SchedulingConfigField } from "@/lib/types"
import { PageHeader } from "@/components/page-header"
import { StatusBadge } from "@/components/status-badge"
import { Pagination } from "@/components/ui/pagination"
import { Search } from "lucide-react"

const emptyCreateForm = {
  first_name: "",
  last_name: "",
  email: "",
  phone: "",
  date_of_birth: "",
}

const input = "w-full border border-slate-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"

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

export default function ClientsPage() {
  const qc = useQueryClient()
  const [search, setSearch] = useState("")
  const [debouncedSearch, setDebouncedSearch] = useState("")
  const [page, setPage] = useState(1)

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 300)
    return () => clearTimeout(t)
  }, [search])

  const { data: config } = useQuery<SchedulingConfig>({
    queryKey: ["scheduling-config"],
    queryFn: () => api.get("/api/scheduling/config"),
  })
  const terms = config?.terms ?? {}
  const clientSingular = terms.client_singular || "Client"
  const clientPlural = `${clientSingular}s`
  const intakeSchema = config?.intake_schema ?? []

  const params = new URLSearchParams()
  params.set("page", String(page))
  params.set("page_size", "20")
  if (debouncedSearch) params.set("search", debouncedSearch)

  const { data, isLoading } = useQuery<Paginated<SchedulingClientList>>({
    queryKey: ["scheduling-clients-list", page, debouncedSearch],
    queryFn: () => api.get(`/api/scheduling/clients?${params.toString()}`),
  })
  const clients = data?.items ?? []
  const totalPages = data ? data.pages : 1

  const [showCreate, setShowCreate] = useState(false)
  const [createForm, setCreateForm] = useState(emptyCreateForm)
  const [customFields, setCustomFields] = useState<Record<string, string>>({})
  const [createError, setCreateError] = useState("")

  const create = useMutation({
    mutationFn: (d: typeof createForm) =>
      api.post("/api/scheduling/clients", {
        first_name: d.first_name,
        last_name: d.last_name,
        email: d.email || undefined,
        phone: d.phone || undefined,
        date_of_birth: d.date_of_birth || undefined,
        custom_fields: customFields,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["scheduling-clients-list"] })
      setShowCreate(false)
      setCreateForm(emptyCreateForm)
      setCustomFields({})
      setCreateError("")
    },
    onError: (e) => setCreateError(e instanceof Error ? e.message : "Failed"),
  })

  return (
    <div>
      <PageHeader
        title={clientPlural}
        description={`Manage ${clientPlural.toLowerCase()} and their records`}
        action={{ label: showCreate ? "Cancel" : `+ New ${clientSingular.toLowerCase()}`, onClick: () => { setShowCreate((v) => !v); setCreateError("") } }}
      />

      {showCreate && (
        <form
          onSubmit={(e) => { e.preventDefault(); create.mutate(createForm) }}
          className="bg-white rounded-xl border border-slate-200 p-5 mb-6 space-y-4"
        >
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">First name *</label>
              <input required value={createForm.first_name}
                onChange={(e) => setCreateForm((f) => ({ ...f, first_name: e.target.value }))}
                className={input} />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Last name *</label>
              <input required value={createForm.last_name}
                onChange={(e) => setCreateForm((f) => ({ ...f, last_name: e.target.value }))}
                className={input} />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Date of birth</label>
              <input type="date" value={createForm.date_of_birth}
                onChange={(e) => setCreateForm((f) => ({ ...f, date_of_birth: e.target.value }))}
                className={input} />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Email</label>
              <input type="email" value={createForm.email}
                onChange={(e) => setCreateForm((f) => ({ ...f, email: e.target.value }))}
                className={input} />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Phone</label>
              <input value={createForm.phone}
                onChange={(e) => setCreateForm((f) => ({ ...f, phone: e.target.value }))}
                className={input} />
            </div>
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

          {createError && <p className="text-sm text-red-600">{createError}</p>}
          <div>
            <button type="submit" disabled={create.isPending}
              className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm disabled:opacity-50">
              {create.isPending ? "Creating…" : `Create ${clientSingular.toLowerCase()}`}
            </button>
          </div>
        </form>
      )}

      <div className="bg-white rounded-xl border border-slate-200 p-4 mb-6">
        <div className="relative max-w-sm">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1) }}
            placeholder={`Search ${clientPlural.toLowerCase()} by name or email…`}
            className="w-full border border-slate-300 rounded-lg pl-9 pr-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12"><div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" /></div>
      ) : (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                {["Name", "Email", "Phone", "Status"].map((h) => (
                  <th key={h} className="text-left px-4 py-3 font-medium text-slate-600">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {clients.length === 0 && (
                <tr><td colSpan={4} className="text-center py-10 text-slate-400">No {clientPlural.toLowerCase()} found</td></tr>
              )}
              {clients.map((c) => (
                <tr key={c.id} className="hover:bg-slate-50">
                  <td className="px-4 py-2.5 font-medium">
                    <Link href={`/scheduling/clients/${c.id}`} className="text-blue-600 hover:underline">
                      {c.first_name} {c.last_name}
                    </Link>
                  </td>
                  <td className="px-4 py-2.5 text-slate-600">{c.email || "—"}</td>
                  <td className="px-4 py-2.5 text-slate-600">{c.phone ?? "—"}</td>
                  <td className="px-4 py-2.5"><StatusBadge value={c.is_active ? "active" : "inactive"} /></td>
                </tr>
              ))}
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
    </div>
  )
}

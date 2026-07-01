"use client"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { useState } from "react"
import { api } from "@/lib/api"
import { PageHeader } from "@/components/page-header"
import { Pagination } from "@/components/ui/pagination"
import type { Enquiry, Paginated } from "@/lib/types"

const TYPE_LABELS: Record<string, string> = {
  general: "General",
  bespoke: "Bespoke",
}

function EnquiryRow({ e, onToggle }: { e: Enquiry; onToggle: () => void }) {
  const [open, setOpen] = useState(false)

  return (
    <>
      <tr
        className={`hover:bg-slate-50 cursor-pointer ${!e.is_read ? "bg-blue-50/40" : ""}`}
        onClick={() => setOpen((v) => !v)}
      >
        <td className="px-4 py-3 w-2">
          <span className={`inline-block w-2 h-2 rounded-full ${e.is_read ? "bg-slate-200" : "bg-blue-500"}`} />
        </td>
        <td className="px-4 py-3">
          <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${
            e.enquiry_type === "bespoke"
              ? "bg-purple-100 text-purple-700"
              : "bg-slate-100 text-slate-600"
          }`}>
            {TYPE_LABELS[e.enquiry_type] ?? e.enquiry_type}
          </span>
        </td>
        <td className="px-4 py-3 font-medium text-slate-800 text-sm">{e.name}</td>
        <td className="px-4 py-3 text-slate-500 text-sm">{e.email}</td>
        <td className="px-4 py-3 text-slate-500 text-sm">{e.subject ?? "—"}</td>
        <td className="px-4 py-3 text-slate-400 text-xs whitespace-nowrap">
          {new Date(e.created_at).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
        </td>
        <td className="px-4 py-3">
          <button
            onClick={(ev) => { ev.stopPropagation(); onToggle() }}
            className={`text-xs px-3 py-1 rounded-lg font-medium transition-colors ${
              e.is_read
                ? "bg-slate-100 text-slate-500 hover:bg-slate-200"
                : "bg-blue-100 text-blue-700 hover:bg-blue-200"
            }`}
          >
            {e.is_read ? "Mark unread" : "Mark read"}
          </button>
        </td>
      </tr>
      {open && (
        <tr className="bg-slate-50 border-b border-slate-100">
          <td colSpan={7} className="px-6 py-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-[13px]">
              <div className="md:col-span-2">
                <p className="font-semibold text-slate-600 mb-1">Message</p>
                <p className="text-slate-700 whitespace-pre-wrap leading-relaxed">{e.message}</p>

                {e.enquiry_type === "bespoke" && (
                  <div className="mt-4 space-y-1.5 text-slate-600">
                    {e.material_type && <p><span className="font-medium">Material:</span> {e.material_type}</p>}
                    {e.size_spec && <p><span className="font-medium">Size/spec:</span> {e.size_spec}</p>}
                    {e.quantity_description && <p><span className="font-medium">Quantity:</span> {e.quantity_description}</p>}
                    {e.deadline && <p><span className="font-medium">Deadline:</span> {e.deadline}</p>}
                  </div>
                )}
              </div>
              <div className="space-y-1.5 text-slate-600">
                {e.phone && <p><span className="font-medium">Phone:</span> {e.phone}</p>}
                {e.company && <p><span className="font-medium">Company:</span> {e.company}</p>}
                <p>
                  <a href={`mailto:${e.email}`} className="text-blue-600 hover:underline font-medium">
                    Reply by email →
                  </a>
                </p>
              </div>
            </div>
          </td>
        </tr>
      )}
    </>
  )
}

export default function EnquiriesPage() {
  const qc = useQueryClient()
  const [page, setPage] = useState(1)

  const { data, isLoading } = useQuery<Paginated<Enquiry>>({
    queryKey: ["enquiries", page],
    queryFn: () => api.get(`/api/contact?page=${page}&page_size=20`),
  })
  const enquiries = data?.items ?? []
  const totalPages = data ? data.pages : 1

  const toggleRead = useMutation({
    mutationFn: (id: string) => api.patch<Enquiry>(`/api/contact/${id}/read`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["enquiries"] }),
  })

  const unreadCount = enquiries.filter((e) => !e.is_read).length

  if (isLoading && !data) {
    return (
      <div>
        <PageHeader title="Enquiries" description="Contact and bespoke enquiries" />
        <div className="flex justify-center py-20">
          <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
        </div>
      </div>
    )
  }

  return (
    <div>
      <PageHeader
        title="Enquiries"
        description={
          data
            ? unreadCount > 0
              ? `${data.total} total · ${unreadCount} unread this page`
              : `${data.total} total`
            : "Contact and bespoke enquiries"
        }
      />
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 border-b border-slate-200">
            <tr>
              {["", "Type", "Name", "Email", "Subject", "Date", "Actions"].map((h) => (
                <th key={h} className="text-left px-4 py-3 text-xs font-medium text-slate-500">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {enquiries.length === 0 && (
              <tr>
                <td colSpan={7} className="text-center py-10 text-slate-400">
                  No enquiries yet
                </td>
              </tr>
            )}
            {enquiries.map((e) => (
              <EnquiryRow
                key={e.id}
                e={e}
                onToggle={() => toggleRead.mutate(e.id)}
              />
            ))}
          </tbody>
        </table>
      </div>
      <Pagination
        page={page}
        totalPages={totalPages}
        onPrev={() => setPage(p => p - 1)}
        onNext={() => setPage(p => p + 1)}
      />
    </div>
  )
}

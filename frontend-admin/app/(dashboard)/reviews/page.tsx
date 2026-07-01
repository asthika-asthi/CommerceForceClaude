"use client"
import { useState } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { api } from "@/lib/api"
import { PageHeader } from "@/components/page-header"
import { Pagination } from "@/components/ui/pagination"
import { Check, Trash2, Star } from "lucide-react"

interface AdminReview {
  id: string
  product_id: string
  user_id: string
  rating: number
  title?: string
  body?: string
  is_approved: boolean
  reviewer_name: string
  reviewer_email: string
  created_at: string
}

interface ReviewsPage {
  items: AdminReview[]
  total: number
  page: number
  page_size: number
  pages: number
}

export default function ReviewsPage() {
  const qc = useQueryClient()
  const [filter, setFilter] = useState<"all" | "pending" | "approved">("all")
  const [page, setPage] = useState(1)

  const isApprovedParam = filter === "pending" ? "false" : filter === "approved" ? "true" : ""

  const { data, isLoading } = useQuery<ReviewsPage>({
    queryKey: ["admin-reviews", filter, page],
    queryFn: () => {
      const params = new URLSearchParams({ page: String(page), page_size: "20" })
      if (isApprovedParam !== "") params.set("is_approved", isApprovedParam)
      return api.get(`/api/reviews/admin/all?${params}`)
    },
  })
  const reviews = data?.items ?? []
  const totalPages = data ? data.pages : 1

  const { data: pendingData } = useQuery<ReviewsPage>({
    queryKey: ["admin-reviews-pending-count"],
    queryFn: () => api.get("/api/reviews/admin/all?is_approved=false&page=1&page_size=1"),
  })
  const pendingCount = pendingData?.total ?? 0

  const approveMutation = useMutation({
    mutationFn: (id: string) => api.patch(`/api/reviews/${id}/approve`, {}),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-reviews"] }),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.del(`/api/reviews/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-reviews"] })
      qc.invalidateQueries({ queryKey: ["admin-reviews-pending-count"] })
    },
  })

  return (
    <div>
      <PageHeader
        title="Reviews"
        description={pendingCount > 0 ? `${pendingCount} pending approval` : "Manage customer reviews"}
      />

      <div className="flex gap-2 mb-6">
        {(["all", "pending", "approved"] as const).map((f) => (
          <button
            key={f}
            onClick={() => { setFilter(f); setPage(1) }}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              filter === f ? "bg-blue-600 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
            }`}
          >
            {f.charAt(0).toUpperCase() + f.slice(1)}
            {f === "pending" && pendingCount > 0 && (
              <span className="ml-1.5 bg-orange-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">{pendingCount}</span>
            )}
          </button>
        ))}
      </div>

      {isLoading && !data ? (
        <div className="flex justify-center py-12">
          <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : reviews.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200 p-10 text-center text-slate-400">
          No {filter === "all" ? "" : filter} reviews found.
        </div>
      ) : (
        <div className="space-y-3">
          {reviews.map((review) => (
            <div
              key={review.id}
              className={`bg-white rounded-xl border p-5 ${
                !review.is_approved ? "border-orange-200 bg-orange-50/30" : "border-slate-200"
              }`}
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-3 mb-1.5">
                    <StarRow rating={review.rating} />
                    {!review.is_approved && (
                      <span className="text-xs font-medium bg-orange-100 text-orange-700 px-2 py-0.5 rounded-full">Pending</span>
                    )}
                    {review.is_approved && (
                      <span className="text-xs font-medium bg-green-100 text-green-700 px-2 py-0.5 rounded-full">Approved</span>
                    )}
                    <span className="text-xs text-slate-400 ml-auto">
                      {new Date(review.created_at).toLocaleDateString("en-GB")}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 mb-2">
                    <span className="font-medium text-slate-700">{review.reviewer_name}</span>
                    {" "}· {review.reviewer_email}
                  </p>
                  {review.title && <p className="font-semibold text-slate-900 text-sm mb-1">{review.title}</p>}
                  {review.body && <p className="text-sm text-slate-600">{review.body}</p>}
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  {!review.is_approved && (
                    <button
                      onClick={() => approveMutation.mutate(review.id)}
                      disabled={approveMutation.isPending}
                      className="flex items-center gap-1 text-xs font-medium bg-green-600 hover:bg-green-700 text-white px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50"
                    >
                      <Check size={12} /> Approve
                    </button>
                  )}
                  <button
                    onClick={() => { if (confirm("Delete this review?")) deleteMutation.mutate(review.id) }}
                    disabled={deleteMutation.isPending}
                    className="p-1.5 rounded-lg hover:bg-red-50 text-slate-400 hover:text-red-500 transition-colors"
                    title="Delete"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
      <Pagination
        page={page}
        totalPages={totalPages}
        onPrev={() => setPage(p => p - 1)}
        onNext={() => setPage(p => p + 1)}
      />
    </div>
  )
}

function StarRow({ rating }: { rating: number }) {
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((n) => (
        <Star
          key={n}
          size={13}
          className={n <= rating ? "text-amber-400" : "text-slate-200"}
          fill={n <= rating ? "currentColor" : "none"}
        />
      ))}
    </div>
  )
}

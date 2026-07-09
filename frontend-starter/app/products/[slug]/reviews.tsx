"use client"
import { useState } from "react"
import { useAuthStore } from "@/store/auth"
import { api } from "@/lib/api"
import type { Review, ReviewSummary } from "@/lib/types"

interface Props {
  productId: string
  initialReviews: Review[]
  summary: ReviewSummary | null
}

export function ProductReviews({ productId, initialReviews, summary }: Props) {
  const user = useAuthStore((s) => s.user)
  const [reviews, setReviews] = useState<Review[]>(initialReviews)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ rating: 5, title: "", body: "" })
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [error, setError] = useState("")

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError("")
    setSubmitting(true)
    try {
      await api.post<Review>("/api/reviews", { product_id: productId, ...form })
      setSubmitted(true)
      setShowForm(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to submit review")
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="mt-16 border-t border-slate-100 pt-10">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-bold text-slate-900">
          Customer reviews
          {reviews.length > 0 && <span className="ml-2 text-base font-normal text-slate-400">({reviews.length})</span>}
        </h2>
        {user && !showForm && !submitted && (
          <button
            onClick={() => setShowForm(true)}
            className="text-sm font-medium text-brand-dark border border-brand-dark hover:bg-brand-dark hover:text-white px-4 py-1.5 rounded-lg transition-colors"
          >
            Write a review
          </button>
        )}
      </div>

      {submitted && (
        <div className="bg-green-50 border border-green-200 text-green-800 text-sm rounded-xl px-4 py-3 mb-6">
          Thank you! Your review has been submitted and is pending approval.
        </div>
      )}

      {showForm && (
        <form onSubmit={handleSubmit} className="bg-slate-50 border border-slate-200 rounded-2xl p-6 mb-8 space-y-4">
          <h3 className="font-semibold text-slate-900">Write a review</h3>
          <div>
            <label className="block text-sm text-slate-600 mb-2">Rating *</label>
            <StarPicker value={form.rating} onChange={(r) => setForm((f) => ({ ...f, rating: r }))} />
          </div>
          <div>
            <label className="block text-sm text-slate-600 mb-1">Title</label>
            <input
              value={form.title}
              onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
              placeholder="Summarise your experience"
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-dark"
            />
          </div>
          <div>
            <label className="block text-sm text-slate-600 mb-1">Review</label>
            <textarea
              value={form.body}
              onChange={(e) => setForm((f) => ({ ...f, body: e.target.value }))}
              rows={4}
              placeholder="Tell others what you think..."
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-dark resize-none"
            />
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <div className="flex gap-3">
            <button type="submit" disabled={submitting}
              className="bg-brand hover:bg-brand-hover text-on-brand text-sm font-medium px-5 py-2 rounded-lg disabled:opacity-50 transition-colors">
              {submitting ? "Submitting..." : "Submit review"}
            </button>
            <button type="button" onClick={() => setShowForm(false)}
              className="text-sm text-slate-500 hover:text-slate-800 px-4 py-2 rounded-lg border border-slate-200 hover:bg-white">
              Cancel
            </button>
          </div>
        </form>
      )}

      {reviews.length === 0 ? (
        <p className="text-slate-400 text-sm">No reviews yet. {user ? "Be the first to review this product." : "Sign in to leave a review."}</p>
      ) : (
        <div className="space-y-6">
          {reviews.map((review) => (
            <div key={review.id} className="border-b border-slate-100 pb-6 last:border-0">
              <div className="flex items-center gap-3 mb-2">
                <StarRow rating={review.rating} />
                {review.reviewer_name && (
                  <span className="text-sm font-medium text-slate-700">{review.reviewer_name}</span>
                )}
                <span className="text-xs text-slate-400 ml-auto">
                  {new Date(review.created_at).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
                </span>
              </div>
              {review.title && <p className="font-semibold text-slate-900 text-sm mb-1">{review.title}</p>}
              {review.body && <p className="text-slate-600 text-sm">{review.body}</p>}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function StarPicker({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  const [hover, setHover] = useState(0)
  return (
    <div className="flex items-center gap-1">
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          onClick={() => onChange(n)}
          onMouseEnter={() => setHover(n)}
          onMouseLeave={() => setHover(0)}
          className="focus:outline-none"
        >
          <svg className={`w-7 h-7 transition-colors ${n <= (hover || value) ? "text-amber-400" : "text-slate-200"} fill-current`} viewBox="0 0 20 20">
            <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
          </svg>
        </button>
      ))}
      <span className="ml-2 text-sm text-slate-500">{value}/5</span>
    </div>
  )
}

function StarRow({ rating }: { rating: number }) {
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((n) => (
        <svg key={n} className={`w-4 h-4 ${n <= rating ? "text-amber-400" : "text-slate-200"} fill-current`} viewBox="0 0 20 20">
          <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
        </svg>
      ))}
    </div>
  )
}
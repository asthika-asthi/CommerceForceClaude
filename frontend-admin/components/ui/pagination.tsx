interface PaginationProps {
  page: number
  totalPages: number
  onPrev: () => void
  onNext: () => void
}

export function Pagination({ page, totalPages, onPrev, onNext }: PaginationProps) {
  if (totalPages <= 1) return null
  return (
    <div className="flex items-center justify-between mt-4 px-1">
      <span className="text-sm text-slate-500">
        Page {page} of {totalPages}
      </span>
      <div className="flex gap-2">
        <button
          onClick={onPrev}
          disabled={page <= 1}
          className="px-3 py-1.5 rounded-lg text-sm border border-slate-300 text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          ← Prev
        </button>
        <button
          onClick={onNext}
          disabled={page >= totalPages}
          className="px-3 py-1.5 rounded-lg text-sm border border-slate-300 text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          Next →
        </button>
      </div>
    </div>
  )
}

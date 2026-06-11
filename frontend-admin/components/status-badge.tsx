const STYLES: Record<string, string> = {
  // Order status
  pending:     "bg-yellow-100 text-yellow-800",
  confirmed:   "bg-blue-100 text-blue-800",
  processing:  "bg-purple-100 text-purple-800",
  shipped:     "bg-indigo-100 text-indigo-800",
  delivered:   "bg-green-100 text-green-800",
  cancelled:   "bg-red-100 text-red-800",
  // Payment status
  paid:        "bg-green-100 text-green-800",
  failed:      "bg-red-100 text-red-800",
  refunded:    "bg-slate-100 text-slate-700",
  // RFQ status
  draft:       "bg-slate-100 text-slate-700",
  submitted:   "bg-yellow-100 text-yellow-800",
  under_review:"bg-blue-100 text-blue-800",
  quoted:      "bg-indigo-100 text-indigo-800",
  accepted:    "bg-green-100 text-green-800",
  rejected:    "bg-red-100 text-red-800",
  expired:     "bg-slate-100 text-slate-500",
  // Boolean
  active:      "bg-green-100 text-green-800",
  inactive:    "bg-slate-100 text-slate-600",
}

export function StatusBadge({ value }: { value: string }) {
  const cls = STYLES[value.toLowerCase()] ?? "bg-slate-100 text-slate-700"
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${cls}`}>
      {value.replace(/_/g, " ")}
    </span>
  )
}

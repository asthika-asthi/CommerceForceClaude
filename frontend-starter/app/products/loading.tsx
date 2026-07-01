export default function ProductsLoading() {
  return (
    <div className="max-w-6xl mx-auto px-4 py-10">
      <div className="flex flex-col md:flex-row gap-8">
        {/* Sidebar skeleton */}
        <aside className="w-full md:w-56 flex-shrink-0 space-y-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-7 bg-slate-200 animate-pulse rounded-lg" />
          ))}
        </aside>

        {/* Main skeleton */}
        <div className="flex-1">
          {/* Search bar skeleton */}
          <div className="mb-6 flex gap-2">
            <div className="flex-1 h-9 bg-slate-200 animate-pulse rounded-lg" />
            <div className="w-20 h-9 bg-slate-200 animate-pulse rounded-lg" />
          </div>
          {/* Product grid skeleton */}
          <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="space-y-2">
                <div className="aspect-square bg-slate-200 animate-pulse rounded-lg" />
                <div className="h-4 bg-slate-200 animate-pulse rounded" />
                <div className="h-4 w-1/2 bg-slate-200 animate-pulse rounded" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

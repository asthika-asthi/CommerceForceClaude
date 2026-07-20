"use client"

interface FilterBarProps {
  currentSort?: string
  currentInStock?: string
  currentCategory?: string
  total: number
}

const sortOptions = [
  { value: "", label: "Default" },
  { value: "price_asc", label: "Price: Low → High" },
  { value: "price_desc", label: "Price: High → Low" },
  { value: "name_asc", label: "Name A → Z" },
  { value: "name_desc", label: "Name Z → A" },
]

export function FilterBar({ currentSort, currentInStock, currentCategory, total }: FilterBarProps) {
  return (
    <>
      {currentCategory && <input type="hidden" name="category" value={currentCategory} />}
      <select name="sort" defaultValue={currentSort ?? ""}
        className="border border-slate-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-dark bg-card-bg"
        onChange={(e) => { (e.target.form as HTMLFormElement).submit() }}>
        {sortOptions.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
      <label className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer">
        <input type="checkbox" name="in_stock" value="1" defaultChecked={currentInStock === "1"}
          onChange={(e) => { (e.target.form as HTMLFormElement).submit() }} />
        In stock only
      </label>
      <span className="text-sm text-slate-400 ml-auto">{total} products</span>
    </>
  )
}

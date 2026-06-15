const STATS = [
  { num: "30", suffix: "+", label: "Years supplying UK trade & retail" },
  { num: "79", suffix: "+", label: "Products across 4 categories" },
  { num: "3", suffix: "", label: "Sourcing continents — Europe, India, Far East" },
  { num: "£75", suffix: "", label: "Free UK delivery threshold ex VAT" },
]

export function StatsBand() {
  return (
    <div className="bg-brand-dark py-12 px-10">
      <div className="max-w-[1280px] mx-auto grid grid-cols-2 md:grid-cols-4 gap-5">
        {STATS.map(({ num, suffix, label }) => (
          <div key={label} className="text-center p-2">
            <div className="text-[40px] font-bold text-white leading-none">
              {num}<em className="text-brand not-italic">{suffix}</em>
            </div>
            <div className="text-[13px] text-[#A8BDD8] mt-2">{label}</div>
          </div>
        ))}
      </div>
    </div>
  )
}

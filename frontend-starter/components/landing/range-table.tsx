const ROWS = [
  { product: "All-Purpose Tarpaulin", cat: "Tarpaulins", sizes: "6×4ft to 30×20ft", use: "General outdoor cover, gardening, camping", stock: "in" },
  { product: "Extra Strong Tarpaulin", cat: "Tarpaulins", sizes: "8×6ft to 20×16ft", use: "Construction sites, haulage, agriculture", stock: "in" },
  { product: "Leno Clear Tarpaulin", cat: "Tarpaulins", sizes: "6×4ft to 16×13ft", use: "Greenhouses, market stalls, light cover", stock: "in" },
  { product: "Calico Cotton Dust Sheet", cat: "Dust Sheets", sizes: "12×9ft · Single / Bale", use: "Decorating, furniture protection", stock: "in" },
  { product: "Polythene Dust Sheet", cat: "Dust Sheets", sizes: "3×2m, 4×3m, 5×4m", use: "Painting, light dust protection", stock: "in" },
  { product: "Heavy Duty Rubble Sacks", cat: "Sacks & Bags", sizes: "Pack 10 / 50 / 100", use: "Building waste, demolition, skip filling", stock: "in" },
  { product: "FIBC Tonne Bags", cat: "Sacks & Bags", sizes: "500kg / 750kg / 1000kg SWL", use: "Aggregates, sand, agricultural produce", stock: "in" },
  { product: "Wheelie Bin Liners", cat: "Sacks & Bags", sizes: "240L / 360L / 660L / 1100L", use: "Commercial waste management", stock: "in" },
  { product: "Emulsion Paint Brushes", cat: "Paint Brushes", sizes: "1\", 2\", 3\", 4\"", use: "Interior walls, ceilings, decorating", stock: "in" },
  { product: "Roller Frames & Sleeves", cat: "Paint Brushes", sizes: "7\", 9\", 12\"", use: "Walls, ceilings, large surface areas", stock: "ltd" },
]

export function RangeTable() {
  return (
    <div className="max-w-[1280px] mx-auto px-10 pb-14">
      <div className="flex justify-between items-baseline mb-8">
        <h2 className="text-[26px] font-bold text-brand-dark">
          Product range <span className="text-brand">quick reference</span>
        </h2>
        <a href="/products" className="text-[13px] font-semibold text-brand flex items-center gap-1 hover:text-brand-hover transition-colors">
          Full catalogue →
        </a>
      </div>
      <div className="bg-white border border-[#E0DED8] rounded-xl overflow-hidden">
        <table className="w-full border-collapse">
          <thead>
            <tr>
              {["Product", "Category", "Sizes / Variants", "Use case", "Availability"].map(h => (
                <th key={h} className="bg-brand-dark text-[#CBD8EE] text-[12px] font-semibold text-left px-5 py-3.5 tracking-[0.4px] uppercase">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {ROWS.map((row, i) => (
              <tr key={row.product} className={`${i % 2 === 1 ? "bg-[#FAFAF8]" : ""} hover:bg-[#FDF0F2] transition-colors`}>
                <td className="px-5 py-3 text-[13px] text-fg border-b border-[#F0EEEA]"><strong>{row.product}</strong></td>
                <td className="px-5 py-3 text-[13px] text-fg border-b border-[#F0EEEA]">{row.cat}</td>
                <td className="px-5 py-3 text-[13px] text-fg border-b border-[#F0EEEA]">{row.sizes}</td>
                <td className="px-5 py-3 text-[13px] text-fg border-b border-[#F0EEEA]">{row.use}</td>
                <td className="px-5 py-3 text-[13px] border-b border-[#F0EEEA]">
                  {row.stock === "in" ? (
                    <span className="inline-block text-[10px] font-bold px-2 py-0.5 rounded-full text-[#059669] bg-[#D1FAE5]">In stock</span>
                  ) : (
                    <span className="inline-block text-[10px] font-bold px-2 py-0.5 rounded-full text-[#D97706] bg-[#FEF3C7]">Limited qty</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

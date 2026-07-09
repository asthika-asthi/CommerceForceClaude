const TRUST_ITEMS = [
  { icon: "🚚", strong: "Free UK Delivery", sub: "On all orders over £75 ex VAT" },
  { icon: "📦", strong: "Same Day Despatch", sub: "Orders placed before 2pm" },
  { icon: "🏭", strong: "Direct Importing", sub: "Europe, India & Far East" },
  { icon: "💼", strong: "Trade Accounts", sub: "Wholesale prices available" },
  { icon: "📅", strong: "Est. 1995", sub: "30 years of reliable supply" },
]

export function TrustStrip() {
  return (
    <div className="bg-white border-b border-border">
      <div className="max-w-[1280px] mx-auto px-10 py-[18px] flex justify-between items-center flex-wrap gap-3">
        {TRUST_ITEMS.map(({ icon, strong, sub }) => (
          <div key={strong} className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-full bg-brand-tint flex items-center justify-center text-base flex-shrink-0">
              {icon}
            </div>
            <div>
              <strong className="block text-[13px] font-semibold text-brand-dark">{strong}</strong>
              <span className="text-[11px] text-muted">{sub}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

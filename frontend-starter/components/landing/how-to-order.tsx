const STEPS = [
  {
    n: 1,
    title: "Browse & select",
    desc: "Find your product by category or search. Filter by size, material, or type. Not sure? Download our full price list.",
  },
  {
    n: 2,
    title: "Login or register",
    desc: "Create a retail account to see prices, or apply for a trade account for wholesale pricing and terms.",
  },
  {
    n: 3,
    title: "Checkout securely",
    desc: "Pay by card, bank transfer, or on account (trade customers). Order confirmation sent instantly.",
  },
  {
    n: 4,
    title: "Fast UK delivery",
    desc: "Orders placed before 2pm despatched same day. Track your delivery online or call 01438 880 178.",
  },
]

export function HowToOrder() {
  return (
    <div className="bg-white py-14">
      <div className="max-w-[1280px] mx-auto px-10">
        <div className="flex justify-between items-baseline mb-8">
          <h2 className="text-[26px] font-bold text-brand-dark">
            How to <span className="text-brand">order from us</span>
          </h2>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-0 relative">
          {/* Connecting line */}
          <div
            className="absolute top-8 hidden md:block h-0.5 rounded"
            style={{ left: "12%", right: "12%", background: "linear-gradient(90deg, var(--brand), var(--brand-dark))" }}
          />
          {STEPS.map(({ n, title, desc }) => (
            <div key={n} className="text-center px-4 relative">
              <div className="w-16 h-16 rounded-full bg-white border-[3px] border-brand flex items-center justify-center text-[22px] font-bold text-brand mx-auto mb-5 relative z-10">
                {n}
              </div>
              <div className="text-[15px] font-bold text-brand-dark mb-2">{title}</div>
              <div className="text-[13px] text-muted leading-[1.55]">{desc}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

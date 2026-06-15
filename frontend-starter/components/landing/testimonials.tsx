const REVIEWS = [
  {
    stars: 5,
    quote: "We've been ordering cotton dust sheets from Tri Star for 12 years. The calico quality has never dropped, the prices are better than any other supplier I've found, and they always get our bulk orders out fast.",
    name: "David W.",
    role: "Painting & decorating contractor, Luton",
    initials: "DW",
    avatarBg: "#C8102E",
  },
  {
    stars: 5,
    quote: "The extra strong tarpaulins are brilliant — we use them on scaffolding every week. Heavy, well made, grommets hold up to the wind. The trade account means I don't have to pay every order, which is a big help for cash flow.",
    name: "Kevin S.",
    role: "Scaffolding company owner, Hertfordshire",
    initials: "KS",
    avatarBg: "#1B2A4A",
  },
  {
    stars: 4,
    quote: "Good range of rubble sacks and tonne bags at sensible prices. Delivery was quick and well packed. Would like even more size options on the tonne bags — but have already ordered three times and will keep coming back.",
    name: "Mike T.",
    role: "Plant hire & groundworks, Stevenage",
    initials: "MT",
    avatarBg: "#059669",
  },
]

export function Testimonials() {
  return (
    <div className="bg-white py-14">
      <div className="max-w-[1280px] mx-auto px-10">
        <div className="flex justify-between items-center mb-8">
          <h2 className="text-[26px] font-bold text-brand-dark">
            What our <span className="text-brand">customers say</span>
          </h2>
          <div className="flex items-center gap-2">
            <span className="text-[#00B67A] text-base">★★★★★</span>
            <span className="text-[13px] text-[#5C5C5C]">4.7 on Trustpilot</span>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          {REVIEWS.map(({ stars, quote, name, role, initials, avatarBg }) => (
            <div key={name} className="bg-white border border-[#E0DED8] rounded-xl p-6 flex flex-col">
              <div className="text-[#D4A017] text-base tracking-[2px] mb-3">
                {"★".repeat(stars)}{"☆".repeat(5 - stars)}
              </div>
              <p className="text-[14px] text-[#3a3a3a] leading-[1.65] mb-4 italic flex-1">&ldquo;{quote}&rdquo;</p>
              <div className="flex items-center gap-2.5">
                <div
                  className="w-[38px] h-[38px] rounded-full flex items-center justify-center text-[14px] font-bold text-white flex-shrink-0"
                  style={{ backgroundColor: avatarBg }}
                >
                  {initials}
                </div>
                <div>
                  <div className="text-[13px] font-bold text-brand-dark">{name}</div>
                  <div className="text-[11px] text-[#5C5C5C]">{role}</div>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Trustpilot bar */}
        <div className="bg-white border border-[#E0DED8] rounded-xl p-5 flex items-center gap-5 flex-wrap">
          <div className="flex items-center gap-3">
            <span className="text-[28px] font-bold text-brand-dark">4.7</span>
            <div>
              <div className="text-[#00B67A] text-[18px]">★★★★★</div>
              <div className="text-[12px] text-[#5C5C5C]">Based on 94 reviews</div>
            </div>
          </div>
          <div className="flex-1 min-w-[180px] text-[13px] text-[#5C5C5C]">
            Tri Star UK Ltd is rated <strong className="text-brand-dark">Excellent</strong> by our customers on Trustpilot.
          </div>
          <button className="bg-[#00B67A] text-white border-none rounded-lg px-[18px] py-2.5 text-[13px] font-semibold cursor-pointer hover:opacity-90 transition-opacity">
            Read all reviews →
          </button>
        </div>
      </div>
    </div>
  )
}

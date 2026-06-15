export function PromoBanner() {
  return (
    <div className="py-3.5 px-10" style={{ background: "linear-gradient(90deg, #C8102E 0%, #8B0019 100%)" }}>
      <div className="max-w-[1280px] mx-auto flex items-center justify-center gap-4 flex-wrap">
        <span className="bg-white/20 text-white text-[11px] font-bold px-2.5 py-1 rounded-full border border-white/30 uppercase tracking-[0.5px]">
          Limited Time
        </span>
        <span className="text-white text-[14px] font-medium">
          Order before 2pm for same-day despatch — free delivery on orders over £75
        </span>
        <a href="/products" className="text-[#ffb3bf] text-[14px] font-semibold border-b border-[#ffb3bf] pb-px cursor-pointer hover:text-white hover:border-white transition-colors">
          Shop now →
        </a>
        <span className="bg-white/20 text-white text-[11px] font-bold px-2.5 py-1 rounded-full border border-white/30 uppercase tracking-[0.5px]">
          New
        </span>
        <span className="text-white text-[14px] font-medium">
          Trade accounts now available — login to see wholesale pricing
        </span>
        <a href="/register" className="text-[#ffb3bf] text-[14px] font-semibold border-b border-[#ffb3bf] pb-px cursor-pointer hover:text-white hover:border-white transition-colors">
          Register →
        </a>
      </div>
    </div>
  )
}

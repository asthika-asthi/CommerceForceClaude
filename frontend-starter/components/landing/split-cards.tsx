import Link from "next/link"

export function SplitCards() {
  return (
    <div className="max-w-[1280px] mx-auto px-10 pb-14 grid grid-cols-1 md:grid-cols-2 gap-5">

      {/* Navy: Trade Account */}
      <div className="rounded-2xl p-10 relative overflow-hidden bg-brand-dark">
        <div className="absolute -bottom-10 -right-10 w-48 h-48 rounded-full bg-white/5 pointer-events-none" />
        <div className="relative z-10">
          <p className="text-[11px] font-bold tracking-[0.8px] uppercase mb-3 text-white/75">For businesses &amp; contractors</p>
          <h2 className="text-[26px] font-bold text-white leading-tight mb-2.5">Open a trade account — buy at wholesale prices</h2>
          <p className="text-[14px] text-white/75 leading-[1.6] mb-6 max-w-[340px]">
            Painters, decorators, builders, and site managers — register for a Tri Star trade account and unlock exclusive pricing, monthly invoicing, and bulk order discounts.
          </p>
          <div className="flex flex-wrap gap-2 mb-7">
            {["✓ Wholesale pricing", "✓ 30-day payment terms", "✓ Dedicated account manager", "✓ Priority despatch", "✓ Volume discounts from 10+ cases"].map(f => (
              <span key={f} className="bg-white/12 text-white/90 text-[12px] font-medium px-[11px] py-[5px] rounded-full border border-white/15">{f}</span>
            ))}
          </div>
          <Link href="/register" className="inline-block bg-white text-brand-dark hover:bg-brand hover:text-on-brand font-bold text-[14px] px-6 py-3 rounded-lg transition-all">
            Register for trade →
          </Link>
        </div>
      </div>

      {/* Red: Bespoke */}
      <div className="rounded-2xl p-10 relative overflow-hidden bg-brand">
        <div className="absolute -bottom-10 -right-10 w-48 h-48 rounded-full bg-white/5 pointer-events-none" />
        <div className="relative z-10">
          <p className="text-[11px] font-bold tracking-[0.8px] uppercase mb-3 text-white/75">Can&apos;t find what you need?</p>
          <h2 className="text-[26px] font-bold text-white leading-tight mb-2.5">Bespoke &amp; bulk orders — we&apos;ll source it</h2>
          <p className="text-[14px] text-white/75 leading-[1.6] mb-6 max-w-[340px]">
            With direct sourcing relationships in Europe, India, and the Far East, we can fulfil custom specifications, unusual sizes, and large volume orders that aren&apos;t on the shelf.
          </p>
          <div className="flex flex-wrap gap-2 mb-7">
            {["✓ Custom sizing available", "✓ Bespoke spec tarpaulins", "✓ Container load quantities", "✓ Private label options"].map(f => (
              <span key={f} className="bg-white/12 text-white/90 text-[12px] font-medium px-[11px] py-[5px] rounded-full border border-white/15">{f}</span>
            ))}
          </div>
          <Link href="/contact" className="inline-block bg-white text-brand hover:bg-brand-dark hover:text-white font-bold text-[14px] px-6 py-3 rounded-lg transition-all">
            Enquire about bulk →
          </Link>
        </div>
      </div>
    </div>
  )
}

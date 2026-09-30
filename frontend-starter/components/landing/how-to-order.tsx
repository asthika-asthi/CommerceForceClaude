import { describeBands } from "@/lib/delivery-bands"
import type { DeliveryBands } from "@/lib/types"
import { dispatchCopy, type DispatchCopy } from "@/lib/dispatch"

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
    desc: "Track your delivery online or call 01438 880 178.",
  },
]

interface Props {
  title?: string
  titleHighlight?: string
  delivery?: DeliveryBands
  dispatch?: DispatchCopy
}

export function HowToOrder({ title = "How to", titleHighlight = "order from us", delivery, dispatch = dispatchCopy() }: Props) {
  // Step 4 spells out the admin-set delivery charges so they match checkout exactly.
  const bandLines = delivery ? describeBands(delivery).lines : []
  // The dispatch promise (admin-editable) leads step 4; blank means we don't make one.
  const promise = (dispatch.subtitle || dispatch.title).replace(/\.$/, "")
  const steps = STEPS.map(s =>
    s.n === 4
      ? { ...s, desc: promise ? `${promise}. ${s.desc}` : s.desc, extra: bandLines.length ? bandLines : undefined }
      : s)
  return (
    <div className="bg-white py-14">
      <div className="max-w-[1280px] mx-auto px-10">
        <div className="flex justify-between items-baseline mb-8">
          <h2 className="text-[26px] font-bold text-brand-dark">
            {title} <span className="text-brand">{titleHighlight}</span>
          </h2>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-0 relative">
          {/* Connecting line */}
          <div
            className="absolute top-8 hidden md:block h-0.5 rounded"
            style={{ left: "12%", right: "12%", background: "linear-gradient(90deg, var(--brand), var(--brand-dark))" }}
          />
          {steps.map(({ n, title, desc, extra }: { n: number; title: string; desc: string; extra?: string[] }) => (
            <div key={n} className="text-center px-4 relative">
              <div className="w-16 h-16 rounded-full bg-white border-[3px] border-brand flex items-center justify-center text-[22px] font-bold text-brand mx-auto mb-5 relative z-10">
                {n}
              </div>
              <div className="text-[15px] font-bold text-brand-dark mb-2">{title}</div>
              <div className="text-[13px] text-muted leading-[1.55]">{desc}</div>
              {extra && (
                <ul className="mt-2 text-[12px] text-muted leading-[1.5] list-none p-0">
                  {extra.map(line => <li key={line}>{line}</li>)}
                </ul>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

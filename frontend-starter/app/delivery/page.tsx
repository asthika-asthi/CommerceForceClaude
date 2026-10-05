import Link from "next/link"
import { serverFetch } from "@/lib/api"
import { getContactDetails } from "@/lib/contact-details"
import { describeBands, getDeliveryBands } from "@/lib/delivery-bands"
import { dispatchCopy } from "@/lib/dispatch"
import type { BrandingConfig } from "@/lib/types"

export const metadata = { title: "Delivery information" }

const workingDays = (n: number) => `${n} working day${n === 1 ? "" : "s"}`

export default async function DeliveryPage() {
  const [bands, branding, contact] = await Promise.all([
    getDeliveryBands().catch(() => null),
    serverFetch<BrandingConfig>("/api/branding").catch(() => null),
    getContactDetails(),
  ])
  const delivery = bands ? describeBands(bands) : null
  const dispatch = dispatchCopy(branding)
  const dispatchLine = [dispatch.title, dispatch.subtitle].filter(Boolean).join(" — ")

  const dispatchDays = branding?.dispatch_days
  const tMin = branding?.transit_days_min
  const tMax = branding?.transit_days_max
  const transit =
    tMin != null && tMax != null
      ? tMin === tMax ? workingDays(tMin) : `${tMin}–${workingDays(tMax)}`
      : tMin != null ? `at least ${workingDays(tMin)}`
      : tMax != null ? `up to ${workingDays(tMax)}`
      : null

  return (
    <div className="max-w-[860px] mx-auto px-6 py-14">
      <h1 className="text-[32px] font-bold text-brand-dark mb-2">Delivery information</h1>
      <p className="text-[15px] text-muted mb-10">
        How we send your order, what it costs and what to do if something isn&apos;t right.
      </p>

      <div className="space-y-8 text-[15px] leading-[1.75] text-fg">
        <section>
          <h2 className="text-[20px] font-bold text-brand-dark mb-3">Delivery charges</h2>
          {delivery ? (
            <>
              {delivery.headline && <p className="font-semibold mb-2">{delivery.headline}.</p>}
              <p className="mb-2">
                Delivery charges depend on the value of your order (after discounts, excluding VAT):
              </p>
              <ul className="list-disc pl-6 space-y-1">
                {delivery.lines.map((line) => <li key={line}>{line}.</li>)}
              </ul>
              <p className="mt-2">The charge that applies is always shown at checkout before you pay.</p>
            </>
          ) : (
            <p>Any delivery charge that applies is shown at checkout before you pay.</p>
          )}
          {branding?.delivery_promo_text && (
            <p className="mt-2 font-medium text-brand-dark">{branding.delivery_promo_text}</p>
          )}
        </section>

        <section>
          <h2 className="text-[20px] font-bold text-brand-dark mb-3">Dispatch and delivery times</h2>
          <ul className="list-disc pl-6 space-y-1">
            {dispatchLine && <li>{dispatchLine}.</li>}
            {dispatchDays != null && (
              <li>In-stock orders are usually despatched within {workingDays(dispatchDays)}.</li>
            )}
            {transit && <li>Once despatched, delivery normally takes {transit}.</li>}
            <li>
              You&apos;ll see an estimated delivery date on each product page. Delivery times are
              estimates and may be affected by couriers or circumstances outside our control.
            </li>
          </ul>
        </section>

        <section>
          <h2 className="text-[20px] font-bold text-brand-dark mb-3">Where we deliver</h2>
          <ul className="list-disc pl-6 space-y-1">
            <li>Standard delivery is to UK mainland addresses unless we&apos;ve agreed otherwise with you.</li>
            <li>For deliveries elsewhere, or large and bulk orders, please get in touch before ordering.</li>
          </ul>
        </section>

        <section>
          <h2 className="text-[20px] font-bold text-brand-dark mb-3">When your order arrives</h2>
          <ul className="list-disc pl-6 space-y-1">
            <li>Please check your goods as soon as they arrive.</li>
            <li>If anything is missing, damaged or not what you ordered, tell us as soon as possible.</li>
            <li>
              For faulty goods and how returns work, see our{" "}
              <Link href="/returns" className="text-brand hover:underline">Returns policy</Link>.
            </li>
          </ul>
        </section>

        <section>
          <h2 className="text-[20px] font-bold text-brand-dark mb-3">Questions about delivery?</h2>
          <p>
            Check the status of an order on our{" "}
            <Link href="/track-order" className="text-brand hover:underline">order tracking</Link> page
            {contact.phone ? <>, call us on {contact.phone}</> : null}
            {contact.email ? <>{contact.phone ? " or email " : ", or email "}<a href={`mailto:${contact.email}`} className="text-brand hover:underline">{contact.email}</a></> : null}
            , or use our <Link href="/contact" className="text-brand hover:underline">contact form</Link>.
          </p>
        </section>
      </div>
    </div>
  )
}

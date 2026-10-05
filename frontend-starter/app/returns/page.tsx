import Link from "next/link"
import { serverFetch } from "@/lib/api"
import { getContactDetails } from "@/lib/contact-details"
import { FAULTY_GOODS_DAYS } from "@/lib/returns-policy"
import type { BrandingConfig } from "@/lib/types"

export const metadata = { title: "Returns policy" }

export default async function ReturnsPage() {
  const [branding, contact] = await Promise.all([
    serverFetch<BrandingConfig>("/api/branding").catch(() => null),
    getContactDetails(),
  ])
  const store = branding?.store_name?.trim() || "We"

  return (
    <div className="max-w-[860px] mx-auto px-6 py-14">
      <h1 className="text-[32px] font-bold text-brand-dark mb-2">Returns policy</h1>
      <p className="text-[15px] text-muted mb-10">
        What to do if something is faulty, damaged or you change your mind.
      </p>

      <div className="space-y-8 text-[15px] leading-[1.75] text-fg">
        <section>
          <h2 className="text-[20px] font-bold text-brand-dark mb-3">Faulty goods</h2>
          <ul className="list-disc pl-6 space-y-1">
            <li>
              If goods are faulty, tell us within <strong>{FAULTY_GOODS_DAYS} days of purchase</strong>.
            </li>
            <li>
              {store} will collect the goods from your delivery location, so there&apos;s no need to
              send them back yourself and no collection charge to you.
            </li>
            <li>Faulty or incorrectly supplied goods are replaced or refunded at our cost.</li>
            <li>
              To arrange a collection, contact us with your order number and a short description
              (photos help) using the details below.
            </li>
          </ul>
        </section>

        <section>
          <h2 className="text-[20px] font-bold text-brand-dark mb-3">Changed your mind?</h2>
          <ul className="list-disc pl-6 space-y-1">
            <li>
              You can cancel within 14 days of receiving your goods (Consumer Contracts Regulations
              2013), unless the goods are bespoke or made to your specification.
            </li>
            <li>Items must be returned unused and in their original packaging, at your own cost.</li>
            <li>Refunds go back to the original payment method within 14 days of us receiving the goods.</li>
          </ul>
        </section>

        <section>
          <h2 className="text-[20px] font-bold text-brand-dark mb-3">Damaged or missing on delivery</h2>
          <ul className="list-disc pl-6 space-y-1">
            <li>Trade account customers should report any shortages or damaged goods within 48 hours of delivery.</li>
            <li>
              Everyone else should tell us as soon as possible. See{" "}
              <Link href="/delivery" className="text-brand hover:underline">Delivery information</Link>.
            </li>
          </ul>
        </section>

        <section>
          <h2 className="text-[20px] font-bold text-brand-dark mb-3">How to contact us about a return</h2>
          <p>
            {contact.phone ? <>Call us on {contact.phone}</> : <>Get in touch</>}
            {contact.email ? <>{contact.phone ? ", email " : " at "}<a href={`mailto:${contact.email}`} className="text-brand hover:underline">{contact.email}</a></> : null}
            {" "}or use our <Link href="/contact" className="text-brand hover:underline">contact form</Link>.
            {contact.hours ? <> We&apos;re available {contact.hours}.</> : null}
          </p>
          <p className="mt-3 text-[13px] text-muted">
            This summarises our returns process. Our full{" "}
            <Link href="/terms" className="text-brand hover:underline">Terms &amp; Conditions</Link> also apply.
          </p>
        </section>
      </div>
    </div>
  )
}

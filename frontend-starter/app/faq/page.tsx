import type { Metadata } from "next"
import Link from "next/link"
import { describeBands, getDeliveryBands } from "@/lib/delivery-bands"

export const metadata: Metadata = {
  title: "FAQs",
  description: "Frequently asked questions about our products, trade accounts, and delivery.",
}

const BASE_FAQS = [
  {
    q: "Do you offer trade accounts?",
    a: "Yes — we offer 30-day credit terms for registered trade customers. Apply via the Register for Trade link in the footer or contact our sales team.",
  },
  {
    q: "What is your minimum order quantity?",
    a: "There is no minimum order quantity for standard products. For bulk or bespoke orders please use our Bespoke Orders enquiry form.",
  },
  {
    q: "How long does delivery take?",
    a: "Standard orders are dispatched within 1–2 working days. Next-day delivery is available on most stock items when ordered before 2 pm.",
  },
  {
    q: "How much does delivery cost?",
    a: "", // filled from the admin-set delivery bands at render time
  },
  {
    q: "Do you deliver throughout the UK?",
    a: "Yes, we deliver to all UK mainland addresses. Deliveries to the Scottish Highlands, Islands, Northern Ireland, and Republic of Ireland may take longer and incur a surcharge.",
  },
  {
    q: "Can I return or exchange an item?",
    a: "We accept returns within 30 days of delivery for unused items in original packaging. Contact us before returning any goods so we can arrange a collection or provide a return address.",
  },
  {
    q: "Do you do bespoke or custom-sized orders?",
    a: "Yes — we can manufacture to custom sizes and specifications for larger orders. Use our Bespoke Orders page to send us your requirements.",
  },
  {
    q: "What payment methods do you accept?",
    a: "We accept Visa, Mastercard, Amex, and BACS bank transfer. Trade account holders can pay on 30-day terms.",
  },
  {
    q: "How do I track my order?",
    a: "Once dispatched you will receive an email with your tracking number. You can view order status in your account under My Orders, or — if you checked out as a guest — use our Track your order page with your order number and email.",
  },
]

export default async function FaqPage() {
  // Delivery charges come from the admin-set bands so the answer matches checkout.
  const bands = await getDeliveryBands()
  const delivery = bands ? describeBands(bands) : null
  const FAQS = BASE_FAQS
    .map(f => f.q === "How much does delivery cost?"
      ? { ...f, a: delivery ? `${delivery.lines.join(". ")}. Order value is measured after discounts and excluding VAT, and the exact charge is shown at checkout before you pay.` : "" }
      : f)
    .filter(f => f.a)
  return (
    <div className="max-w-3xl mx-auto px-4 py-16">
      <h1 className="text-3xl font-bold text-brand-dark mb-2">Frequently Asked Questions</h1>
      <p className="text-slate-500 mb-10">
        Can&apos;t find the answer you need?{" "}
        <Link href="/contact" className="text-brand-dark hover:underline font-medium">Get in touch</Link>.
      </p>

      <div className="divide-y divide-slate-200">
        {FAQS.map(({ q, a }) => (
          <details key={q} className="group py-5">
            <summary className="flex justify-between items-center cursor-pointer list-none">
              <span className="font-semibold text-slate-900 pr-6">{q}</span>
              <span className="flex-shrink-0 text-brand-dark text-xl group-open:rotate-45 transition-transform">+</span>
            </summary>
            <p className="mt-3 text-slate-600 text-sm leading-relaxed">{a}</p>
          </details>
        ))}
      </div>

      <div className="mt-12 bg-slate-50 rounded-xl p-6 border border-slate-200">
        <h2 className="font-semibold text-slate-900 mb-1">Still have questions?</h2>
        <p className="text-sm text-slate-500 mb-4">Our team is happy to help with any enquiry.</p>
        <Link href="/contact"
          className="inline-block bg-brand hover:bg-brand-hover text-on-brand text-sm font-semibold px-5 py-2.5 rounded-lg transition-colors">
          Contact us →
        </Link>
      </div>
    </div>
  )
}

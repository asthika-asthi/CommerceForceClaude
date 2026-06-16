export const metadata = { title: "Terms & Conditions — Tri Star UK Ltd" }

const LAST_UPDATED = "June 2026"

export default function TermsPage() {
  return (
    <div className="max-w-[860px] mx-auto px-6 py-14">
      <h1 className="text-[32px] font-bold text-brand-dark mb-2">Terms &amp; Conditions</h1>
      <p className="text-[13px] text-[#9a9a9a] mb-10">Last updated: {LAST_UPDATED}</p>

      <div className="space-y-8 text-[15px] leading-[1.75] text-[#3a3a3a]">

        <section>
          <h2 className="text-[20px] font-bold text-brand-dark mb-3">1. About us</h2>
          <p>These terms and conditions govern your use of the Tri Star UK Ltd website and the purchase of goods from us. Tri Star UK Ltd is a company registered in England and Wales. By placing an order or creating an account, you agree to these terms.</p>
        </section>

        <section>
          <h2 className="text-[20px] font-bold text-brand-dark mb-3">2. Ordering</h2>
          <ul className="list-disc pl-6 space-y-1">
            <li>Orders may be placed online, by phone, or by email.</li>
            <li>An order is confirmed once you receive an order confirmation email from us.</li>
            <li>We reserve the right to cancel or refuse any order (e.g. where a product is out of stock or a pricing error has occurred). In such cases, you will be notified promptly and any payment refunded.</li>
            <li>Trade account orders are subject to approved credit limits.</li>
          </ul>
        </section>

        <section>
          <h2 className="text-[20px] font-bold text-brand-dark mb-3">3. Prices and payment</h2>
          <ul className="list-disc pl-6 space-y-1">
            <li>All prices shown are exclusive of VAT unless otherwise stated. VAT is added at checkout at the current rate.</li>
            <li>We accept payment by debit/credit card, BACS transfer, and via approved trade accounts.</li>
            <li>Trade account invoices are due within 30 days of invoice date unless otherwise agreed.</li>
            <li>We reserve the right to change prices at any time without prior notice, but the price you pay is fixed at the time your order is confirmed.</li>
          </ul>
        </section>

        <section>
          <h2 className="text-[20px] font-bold text-brand-dark mb-3">4. Delivery</h2>
          <ul className="list-disc pl-6 space-y-1">
            <li>We aim to despatch all in-stock orders placed before 2pm on the same business day.</li>
            <li>Standard delivery is to UK mainland addresses only unless agreed otherwise.</li>
            <li>Free standard delivery is offered on orders over £75 ex VAT. Orders below this threshold are subject to a delivery charge shown at checkout.</li>
            <li>Delivery timescales are estimates; we are not liable for delays caused by couriers or circumstances outside our control.</li>
            <li>Risk in the goods passes to you upon delivery.</li>
          </ul>
        </section>

        <section>
          <h2 className="text-[20px] font-bold text-brand-dark mb-3">5. Returns and refunds</h2>
          <ul className="list-disc pl-6 space-y-1">
            <li>You have the right to cancel your order within 14 days of receiving goods (Consumer Contracts Regulations 2013), unless goods are bespoke or made to your specification.</li>
            <li>To return goods, contact us within 14 days of receipt. Items must be returned unused, in original packaging, at your own cost unless the item is faulty.</li>
            <li>Refunds will be processed within 14 days of receiving the returned goods, to the original payment method.</li>
            <li>Faulty or incorrectly supplied goods will be replaced or refunded at our cost.</li>
            <li>Trade account customers should report any shortages or damaged goods within 48 hours of delivery.</li>
          </ul>
        </section>

        <section>
          <h2 className="text-[20px] font-bold text-brand-dark mb-3">6. Product descriptions</h2>
          <p>We make every effort to ensure product descriptions, images, and specifications are accurate. However, minor variations may occur. Dimensions given are approximate. If a product does not match its description, please contact us and we will resolve the issue promptly.</p>
        </section>

        <section>
          <h2 className="text-[20px] font-bold text-brand-dark mb-3">7. Limitation of liability</h2>
          <p>We shall not be liable for any indirect, special, or consequential losses arising from use of our products or website, except where such liability cannot be excluded by law. Our total liability to you for any claim shall not exceed the value of the goods you purchased.</p>
        </section>

        <section>
          <h2 className="text-[20px] font-bold text-brand-dark mb-3">8. Trade accounts</h2>
          <ul className="list-disc pl-6 space-y-1">
            <li>Trade accounts are subject to approval. We reserve the right to decline any application.</li>
            <li>Credit limits are set at our discretion and may be reviewed at any time.</li>
            <li>Late payment may result in suspension of the trade account and interest charges.</li>
          </ul>
        </section>

        <section>
          <h2 className="text-[20px] font-bold text-brand-dark mb-3">9. Governing law</h2>
          <p>These terms are governed by the law of England and Wales. Any disputes shall be subject to the exclusive jurisdiction of the courts of England and Wales.</p>
        </section>

        <section>
          <h2 className="text-[20px] font-bold text-brand-dark mb-3">10. Contact</h2>
          <div className="bg-[#F5F5F3] rounded-lg p-4 text-[14px]">
            <p><strong>Tri Star UK Ltd</strong><br />
            Stevenage, Hertfordshire<br />
            Email: <a href="mailto:info@tristarukltd.co.uk" className="text-brand hover:underline">info@tristarukltd.co.uk</a><br />
            Phone: 01438 880 178</p>
          </div>
        </section>

      </div>
    </div>
  )
}

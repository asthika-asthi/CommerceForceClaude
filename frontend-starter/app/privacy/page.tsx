export const metadata = { title: "Privacy Policy — Tri Star UK Ltd" }

const LAST_UPDATED = "June 2026"

export default function PrivacyPage() {
  return (
    <div className="max-w-[860px] mx-auto px-6 py-14">
      <h1 className="text-[32px] font-bold text-brand-dark mb-2">Privacy Policy</h1>
      <p className="text-[13px] text-text-placeholder mb-10">Last updated: {LAST_UPDATED}</p>

      <div className="prose prose-slate max-w-none space-y-8 text-[15px] leading-[1.75] text-fg">

        <section>
          <h2 className="text-[20px] font-bold text-brand-dark mb-3">1. Who we are</h2>
          <p>Tri Star UK Ltd (&ldquo;we&rdquo;, &ldquo;our&rdquo;, &ldquo;us&rdquo;) is a company registered in England and Wales. We supply tarpaulins, dust sheets, sacks, bags, and decorating materials to trade and retail customers throughout the UK. This Privacy Policy explains how we collect, use, and protect your personal data when you use our website or purchase from us.</p>
        </section>

        <section>
          <h2 className="text-[20px] font-bold text-brand-dark mb-3">2. Data we collect</h2>
          <p>We may collect the following personal data:</p>
          <ul className="list-disc pl-6 space-y-1 mt-2">
            <li><strong>Identity data:</strong> first name, last name, company name</li>
            <li><strong>Contact data:</strong> email address, telephone number, delivery address</li>
            <li><strong>Transaction data:</strong> details of products purchased, payment method, order history</li>
            <li><strong>Technical data:</strong> IP address, browser type, pages visited, time spent on site</li>
            <li><strong>Marketing data:</strong> your preferences for receiving marketing from us</li>
          </ul>
          <p className="mt-3">We do not collect special category data (e.g. health, racial origin, political opinions).</p>
        </section>

        <section>
          <h2 className="text-[20px] font-bold text-brand-dark mb-3">3. How we use your data</h2>
          <p>We use your personal data to:</p>
          <ul className="list-disc pl-6 space-y-1 mt-2">
            <li>Process and fulfil your orders (contractual necessity)</li>
            <li>Manage your account and trade account application</li>
            <li>Send order confirmation and shipping notifications</li>
            <li>Respond to enquiries and provide customer support</li>
            <li>Send marketing emails where you have opted in (you can unsubscribe at any time)</li>
            <li>Improve our website and services (legitimate interests)</li>
            <li>Comply with legal obligations (e.g. tax records)</li>
          </ul>
        </section>

        <section>
          <h2 className="text-[20px] font-bold text-brand-dark mb-3">4. Legal basis for processing</h2>
          <p>We process your data under the following lawful bases as defined by UK GDPR:</p>
          <ul className="list-disc pl-6 space-y-1 mt-2">
            <li><strong>Contract:</strong> to fulfil orders you place with us</li>
            <li><strong>Legal obligation:</strong> to comply with tax and accounting law</li>
            <li><strong>Legitimate interests:</strong> to operate and improve our business</li>
            <li><strong>Consent:</strong> for marketing emails — you can withdraw consent at any time</li>
          </ul>
        </section>

        <section>
          <h2 className="text-[20px] font-bold text-brand-dark mb-3">5. Data sharing</h2>
          <p>We do not sell your personal data. We may share data with trusted third parties only where necessary:</p>
          <ul className="list-disc pl-6 space-y-1 mt-2">
            <li>Payment processors (to handle card payments securely)</li>
            <li>Delivery carriers (to ship your orders)</li>
            <li>IT service providers (website hosting, email delivery)</li>
            <li>HM Revenue & Customs or other authorities where legally required</li>
          </ul>
        </section>

        <section>
          <h2 className="text-[20px] font-bold text-brand-dark mb-3">6. Data retention</h2>
          <p>We retain personal data for as long as necessary for the purpose it was collected:</p>
          <ul className="list-disc pl-6 space-y-1 mt-2">
            <li>Customer account data: for the duration of your account plus 2 years after closure</li>
            <li>Order records: 7 years (legal requirement for tax purposes)</li>
            <li>Marketing preferences: until you unsubscribe or withdraw consent</li>
            <li>Website analytics: 26 months</li>
          </ul>
        </section>

        <section>
          <h2 className="text-[20px] font-bold text-brand-dark mb-3">7. Your rights</h2>
          <p>Under UK GDPR you have the right to:</p>
          <ul className="list-disc pl-6 space-y-1 mt-2">
            <li><strong>Access</strong> the personal data we hold about you</li>
            <li><strong>Rectify</strong> inaccurate or incomplete data</li>
            <li><strong>Erase</strong> your data (&ldquo;right to be forgotten&rdquo;) in certain circumstances</li>
            <li><strong>Restrict</strong> processing of your data</li>
            <li><strong>Port</strong> your data to another provider</li>
            <li><strong>Object</strong> to processing based on legitimate interests</li>
            <li><strong>Withdraw consent</strong> at any time (where processing is based on consent)</li>
          </ul>
          <p className="mt-3">To exercise any of these rights, contact us at the address below. We will respond within 30 days.</p>
        </section>

        <section>
          <h2 className="text-[20px] font-bold text-brand-dark mb-3">8. Cookies</h2>
          <p>We use cookies to make our website work and to improve your experience. See our <a href="/cookies" className="text-brand hover:underline">Cookie Policy</a> for full details.</p>
        </section>

        <section>
          <h2 className="text-[20px] font-bold text-brand-dark mb-3">9. Security</h2>
          <p>We implement appropriate technical and organisational measures to protect your personal data against unauthorised access, loss, or destruction. Passwords are hashed and never stored in plain text. Connections to our website use HTTPS encryption.</p>
        </section>

        <section>
          <h2 className="text-[20px] font-bold text-brand-dark mb-3">10. Contact us</h2>
          <p>If you have questions about this Privacy Policy or wish to exercise your rights, please contact us:</p>
          <div className="mt-3 bg-bg rounded-lg p-4 text-[14px]">
            <p><strong>Tri Star UK Ltd</strong><br />
            Stevenage, Hertfordshire<br />
            Email: <a href="mailto:info@tristarukltd.co.uk" className="text-brand hover:underline">info@tristarukltd.co.uk</a><br />
            Phone: 01438 880 178</p>
          </div>
          <p className="mt-3">You also have the right to complain to the <a href="https://ico.org.uk" target="_blank" rel="noopener noreferrer" className="text-brand hover:underline">Information Commissioner&apos;s Office (ICO)</a> if you believe we are not handling your data correctly.</p>
        </section>

      </div>
    </div>
  )
}

export const metadata = { title: "Cookie Policy — Tri Star UK Ltd" }

const LAST_UPDATED = "June 2026"

export default function CookiesPage() {
  return (
    <div className="max-w-[860px] mx-auto px-6 py-14">
      <h1 className="text-[32px] font-bold text-brand-dark mb-2">Cookie Policy</h1>
      <p className="text-[13px] text-text-placeholder mb-10">Last updated: {LAST_UPDATED}</p>

      <div className="space-y-8 text-[15px] leading-[1.75] text-fg">

        <section>
          <h2 className="text-[20px] font-bold text-brand-dark mb-3">What are cookies?</h2>
          <p>Cookies are small text files stored on your device when you visit a website. They are widely used to make websites work efficiently and to provide information to the website owner.</p>
        </section>

        <section>
          <h2 className="text-[20px] font-bold text-brand-dark mb-3">Cookies we use</h2>

          <div className="overflow-x-auto">
            <table className="w-full border border-border rounded-xl overflow-hidden text-[14px]">
              <thead className="bg-bg">
                <tr>
                  {["Cookie name", "Purpose", "Duration", "Type"].map(h => (
                    <th key={h} className="text-left px-4 py-3 font-semibold text-brand-dark border-b border-border">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {[
                  { name: "refresh_token", purpose: "Keeps you logged in between sessions", duration: "7 days", type: "Essential" },
                  { name: "cart_session", purpose: "Maintains your shopping cart as a guest", duration: "Session", type: "Essential" },
                  { name: "_ga, _gid", purpose: "Google Analytics — measures site traffic and usage (only if enabled and you accept)", duration: "2 years / 24h", type: "Analytics" },
                  { name: "_fbp", purpose: "Meta Pixel — measures ad performance (only if enabled and you accept)", duration: "3 months", type: "Analytics" },
                ].map(row => (
                  <tr key={row.name} className="hover:bg-surface-alt">
                    <td className="px-4 py-3 font-mono text-[13px] text-brand-dark">{row.name}</td>
                    <td className="px-4 py-3 text-muted">{row.purpose}</td>
                    <td className="px-4 py-3 text-muted whitespace-nowrap">{row.duration}</td>
                    <td className="px-4 py-3">
                      <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${
                        row.type === "Essential"
                          ? "bg-brand-dark/10 text-brand-dark"
                          : "bg-[#FFF8E1] text-[#856404]"
                      }`}>{row.type}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section>
          <h2 className="text-[20px] font-bold text-brand-dark mb-3">Essential cookies</h2>
          <p>Essential cookies are necessary for the website to function. They cannot be disabled. They include cookies that keep you logged in, maintain your shopping cart, and protect against fraud. No personal data is sent to third parties through essential cookies.</p>
        </section>

        <section>
          <h2 className="text-[20px] font-bold text-brand-dark mb-3">Analytics cookies</h2>
          <p>If enabled for this store, we may use Google Analytics and/or Meta Pixel to understand how visitors interact with our site. These only load after you accept non-essential cookies in the banner shown on your first visit — declining or dismissing the banner keeps them switched off. You can opt out of Google Analytics at any time by installing the <a href="https://tools.google.com/dlpage/gaoptout" target="_blank" rel="noopener noreferrer" className="text-brand hover:underline">Google Analytics Opt-out Browser Add-on</a>.</p>
        </section>

        <section>
          <h2 className="text-[20px] font-bold text-brand-dark mb-3">Managing cookies</h2>
          <p>You can control cookies through your browser settings. Most browsers allow you to:</p>
          <ul className="list-disc pl-6 space-y-1 mt-2">
            <li>View which cookies are stored</li>
            <li>Delete all or specific cookies</li>
            <li>Block cookies from specific sites</li>
            <li>Block all third-party cookies</li>
          </ul>
          <p className="mt-3">Please note that disabling essential cookies will affect website functionality — you may not be able to log in or maintain a shopping cart.</p>
        </section>

        <section>
          <h2 className="text-[20px] font-bold text-brand-dark mb-3">Contact us</h2>
          <p>If you have questions about our use of cookies, please contact us:</p>
          <div className="bg-bg rounded-lg p-4 text-[14px] mt-3">
            <p><strong>Tri Star UK Ltd</strong><br />
            Email: <a href="mailto:info@tristarukltd.co.uk" className="text-brand hover:underline">info@tristarukltd.co.uk</a></p>
          </div>
        </section>

      </div>
    </div>
  )
}

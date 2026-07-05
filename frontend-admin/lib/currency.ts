// Store currency, set per client at build time via NEXT_PUBLIC_CURRENCY_CODE (e.g. GBP, USD, INR).
const SYMBOLS: Record<string, string> = {
  GBP: "£", USD: "$", EUR: "€", INR: "₹",
  AUD: "A$", CAD: "C$", AED: "د.إ", SGD: "S$", NZD: "NZ$",
}

const CODE = (process.env.NEXT_PUBLIC_CURRENCY_CODE ?? "GBP").toUpperCase()

export const CURRENCY_SYMBOL = SYMBOLS[CODE] ?? `${CODE} `

/** Format an amount with the store currency symbol, e.g. "£12.00" / "$12.00". */
export function formatMoney(amount: number | string): string {
  const n = typeof amount === "string" ? parseFloat(amount) : amount
  return `${CURRENCY_SYMBOL}${(Number.isFinite(n) ? n : 0).toFixed(2)}`
}

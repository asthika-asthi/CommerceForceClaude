/** Derives a 1-2 letter monogram from a store name, e.g. "Tristar (UK) Ltd." -> "TU". */
export function getStoreInitials(name: string): string {
  const words = name
    .replace(/[^A-Za-z0-9\s]/g, "")
    .trim()
    .split(/\s+/)
    .filter(Boolean)
  if (words.length === 0) return ""
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase()
  return (words[0][0] + words[1][0]).toUpperCase()
}

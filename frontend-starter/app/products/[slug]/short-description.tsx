interface Props {
  text?: string | null
}

/**
 * Renders the product's short summary. Lines beginning with "-" or "*" become a
 * bullet list; otherwise the text renders as paragraphs. Hidden when empty.
 */
export function ShortDescription({ text }: Props) {
  const trimmed = (text ?? "").trim()
  if (!trimmed) return null

  const lines = trimmed.split(/\r?\n/).map((l) => l.trim()).filter(Boolean)
  const bulletLines = lines.filter((l) => /^[-*]\s+/.test(l))
  const isBulleted = bulletLines.length > 0 && bulletLines.length === lines.length

  if (isBulleted) {
    return (
      <ul className="my-4 space-y-1.5 text-sm text-fg list-disc pl-5 marker:text-muted">
        {lines.map((line, i) => (
          <li key={i}>{line.replace(/^[-*]\s+/, "")}</li>
        ))}
      </ul>
    )
  }

  return (
    <div className="my-4 prose prose-sm prose-slate max-w-none text-fg">
      {lines.map((line, i) => (
        <p key={i}>{line}</p>
      ))}
    </div>
  )
}

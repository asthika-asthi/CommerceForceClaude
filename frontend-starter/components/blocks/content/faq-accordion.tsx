interface FaqItem {
  question: string
  answer: string
}

interface FaqAccordionProps {
  kicker?: string
  title: string
  items: FaqItem[]
  anchorId?: string
}

export function FaqAccordion({ kicker, title, items, anchorId }: FaqAccordionProps) {
  return (
    <section id={anchorId} className="py-20 px-6 bg-surface-alt" aria-label="Frequently asked questions">
      <div className="max-w-3xl mx-auto">
        <div className="text-center mb-12">
          {kicker && <p className="text-sm font-semibold uppercase tracking-widest text-brand mb-3">{kicker}</p>}
          <h2 className="font-heading text-3xl md:text-4xl font-bold text-fg">{title}</h2>
        </div>
        <div className="space-y-3">
          {items.map((item) => (
            <details key={item.question} className="group rounded-xl border border-border bg-card-bg px-6 py-4 open:pb-6">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-semibold text-fg marker:hidden [&::-webkit-details-marker]:hidden">
                {item.question}
                <span className="text-brand transition-transform motion-reduce:transition-none group-open:rotate-45" aria-hidden>+</span>
              </summary>
              <p className="mt-4 text-muted leading-relaxed">{item.answer}</p>
            </details>
          ))}
        </div>
      </div>
    </section>
  )
}

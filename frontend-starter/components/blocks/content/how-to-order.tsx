interface Step {
  number?: number
  title?: string
  description?: string
}

interface HowToOrderProps {
  title?: string
  steps?: Step[]
}

export function HowToOrder({ title = 'How to order from us', steps = [] }: HowToOrderProps) {
  return (
    <section className="py-14 px-6 bg-card-bg">
      <div className="max-w-6xl mx-auto">
        {title && (
          <h2 className="font-heading text-2xl font-bold text-brand-dark text-center mb-12">{title}</h2>
        )}
        <div className={`grid grid-cols-2 ${steps.length === 5 ? 'md:grid-cols-5' : 'md:grid-cols-4'} gap-8 relative`}>
          {/* connector line — hidden on mobile */}
          <div className="hidden md:block absolute top-8 left-[18%] right-[18%] h-0.5 bg-gradient-to-r from-brand to-brand-dark pointer-events-none" />
          {steps.map((step, i) => (
            <div key={i} className="relative flex flex-col items-center text-center">
              <div className="w-16 h-16 rounded-full border-[3px] border-brand bg-card-bg flex items-center justify-center mb-4 relative z-10 shadow-sm">
                <span className="text-[22px] font-bold text-brand">{step.number ?? i + 1}</span>
              </div>
              <h3 className="text-[15px] font-bold text-brand-dark mb-2">{step.title}</h3>
              <p className="text-[13px] text-muted leading-[1.55]">{step.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

interface Stat {
  prefix?: string
  number?: string
  suffix?: string
  label?: string
}

interface StatsBandProps {
  stats?: Stat[]
}

export function StatsBand({ stats = [] }: StatsBandProps) {
  return (
    <section className="bg-[#1B2A4A] py-12 px-6">
      <div className="max-w-6xl mx-auto grid grid-cols-2 md:grid-cols-4 gap-8">
        {stats.map((stat, i) => (
          <div key={i} className="text-center">
            <p className="text-[40px] font-bold text-white leading-none mb-2">
              {stat.prefix && <span className="text-[#C8102E]">{stat.prefix}</span>}
              <span>{stat.number}</span>
              {stat.suffix && <span className="text-[#C8102E]">{stat.suffix}</span>}
            </p>
            <p className="text-[13px] text-[#A8BDD8] leading-snug">{stat.label}</p>
          </div>
        ))}
      </div>
    </section>
  )
}

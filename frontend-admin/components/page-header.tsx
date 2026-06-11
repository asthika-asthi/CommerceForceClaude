import Link from "next/link"

interface Props {
  title: string
  description?: string
  action?: { label: string; href?: string; onClick?: () => void }
}

export function PageHeader({ title, description, action }: Props) {
  return (
    <div className="flex items-start justify-between mb-6">
      <div>
        <h2 className="text-xl font-semibold text-slate-900">{title}</h2>
        {description && <p className="text-sm text-slate-500 mt-0.5">{description}</p>}
      </div>
      {action && (
        action.href ? (
          <Link
            href={action.href}
            className="bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
          >
            {action.label}
          </Link>
        ) : (
          <button
            onClick={action.onClick}
            className="bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
          >
            {action.label}
          </button>
        )
      )}
    </div>
  )
}

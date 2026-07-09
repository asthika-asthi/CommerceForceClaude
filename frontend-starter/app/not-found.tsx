import Link from "next/link"

export default function NotFound() {
  return (
    <div className="min-h-[60vh] flex flex-col items-center justify-center px-4 text-center">
      <p className="text-6xl font-extrabold text-brand-dark mb-4">404</p>
      <h1 className="text-2xl font-bold text-slate-900 mb-2">Page not found</h1>
      <p className="text-slate-500 mb-8 max-w-sm">
        The page you&apos;re looking for doesn&apos;t exist or has been moved.
      </p>
      <Link
        href="/products"
        className="inline-block bg-brand hover:bg-brand-hover text-on-brand font-semibold px-6 py-3 rounded-xl transition-colors"
      >
        Back to shop
      </Link>
    </div>
  )
}

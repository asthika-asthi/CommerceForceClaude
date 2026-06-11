import Link from "next/link"
import { CheckCircle } from "lucide-react"

interface Props {
  searchParams: Promise<{ order?: string }>
}

export const metadata = { title: "Order confirmed" }

export default async function OrderSuccessPage({ searchParams }: Props) {
  const { order } = await searchParams

  return (
    <div className="min-h-[60vh] flex items-center justify-center px-4">
      <div className="max-w-md w-full text-center">
        <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
          <CheckCircle className="text-green-600" size={32} />
        </div>
        <h1 className="text-2xl font-bold text-slate-900 mb-2">Order confirmed!</h1>
        {order && (
          <p className="text-slate-500 mb-2">Order #{order}</p>
        )}
        <p className="text-slate-500 mb-8">
          Thank you for your purchase. You'll receive an email confirmation shortly.
        </p>
        <div className="flex gap-3 justify-center">
          <Link href={`/account/orders/${order}`}
            className="px-5 py-2.5 border border-slate-200 text-slate-700 rounded-xl text-sm hover:bg-slate-50 transition-colors">
            View order
          </Link>
          <Link href="/products"
            className="px-5 py-2.5 bg-brand hover:bg-brand-hover text-white rounded-xl text-sm transition-colors">
            Continue shopping
          </Link>
        </div>
      </div>
    </div>
  )
}

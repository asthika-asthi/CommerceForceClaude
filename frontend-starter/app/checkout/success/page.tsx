"use client"
import { Suspense, useEffect, useState } from "react"
import Link from "next/link"
import { useSearchParams } from "next/navigation"
import { CheckCircle } from "lucide-react"
import { useAuthStore } from "@/store/auth"
import { api } from "@/lib/api"
import type { BrandingConfig } from "@/lib/types"

export default function OrderSuccessPage() {
  return (
    <Suspense fallback={null}>
      <OrderSuccessContent />
    </Suspense>
  )
}

function OrderSuccessContent() {
  const searchParams = useSearchParams()
  const order_id = searchParams.get("order_id") ?? undefined
  const order_number = searchParams.get("order_number") ?? undefined
  const payment_method = searchParams.get("payment_method") ?? undefined
  const user = useAuthStore((s) => s.user)
  const displayNumber = order_number ?? order_id

  const needsManualPayment = payment_method === "bank_transfer" || payment_method === "paypal"
  const [branding, setBranding] = useState<BrandingConfig | null>(null)

  useEffect(() => {
    if (!needsManualPayment) return
    api.get<BrandingConfig>("/api/branding").then(setBranding).catch(() => {})
  }, [needsManualPayment])

  // Logged-in customers can deep-link straight to their account order page;
  // guests (and anyone not currently signed in) don't have access to that
  // authenticated route, so send them to the public tracking form instead.
  const viewOrderHref =
    user && order_id
      ? `/account/orders/${order_id}`
      : order_number
        ? `/track-order?order_number=${encodeURIComponent(order_number)}`
        : "/track-order"

  return (
    <div className="min-h-[60vh] flex items-center justify-center px-4">
      <div className="max-w-md w-full text-center">
        <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
          <CheckCircle className="text-green-600" size={32} />
        </div>
        <h1 className="text-2xl font-bold text-slate-900 mb-2">Order confirmed!</h1>
        {displayNumber && (
          <p className="text-slate-500 mb-2 font-medium">Order {displayNumber}</p>
        )}
        <p className="text-slate-500 mb-8">
          Thank you for your purchase. A confirmation email has been sent to you.
        </p>

        {needsManualPayment && branding && (
          <div className="text-left mb-8 border border-slate-200 rounded-xl p-4">
            {payment_method === "bank_transfer" && branding.bank_transfer_details && (
              <>
                <p className="text-sm font-medium text-slate-900 mb-2">Bank transfer details</p>
                <p className="text-sm text-slate-700 whitespace-pre-line">{branding.bank_transfer_details}</p>
              </>
            )}
            {payment_method === "paypal" && branding.paypal_email && (
              <p className="text-sm text-slate-700">
                Send the total amount to <span className="font-medium">{branding.paypal_email}</span> via PayPal.
              </p>
            )}
            {displayNumber && (
              <p className="mt-3 text-xs text-slate-500">
                Please quote order number <span className="font-medium">{displayNumber}</span> as your payment reference. Your order will be confirmed once we receive your payment.
              </p>
            )}
          </div>
        )}

        <div className="flex gap-3 justify-center">
          {(order_id || order_number) && (
            <Link href={viewOrderHref}
              className="px-5 py-2.5 border border-slate-200 text-slate-700 rounded-xl text-sm hover:bg-slate-50 transition-colors">
              View order
            </Link>
          )}
          <Link href="/products"
            className="px-5 py-2.5 bg-brand hover:bg-brand-hover text-on-brand rounded-xl text-sm transition-colors">
            Continue shopping
          </Link>
        </div>
      </div>
    </div>
  )
}

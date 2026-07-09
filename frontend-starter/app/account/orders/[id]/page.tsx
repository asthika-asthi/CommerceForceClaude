"use client"
import { useEffect, useState } from "react"
import { useRouter, useParams } from "next/navigation"
import { useAuthStore } from "@/store/auth"
import { api } from "@/lib/api"
import type { Order } from "@/lib/types"
import Link from "next/link"
import { ArrowLeft } from "lucide-react"
import { OrderDetailCard } from "@/components/shop/order-detail-card"

export default function OrderDetailPage() {
  const params = useParams()
  const id = params.id as string
  const user = useAuthStore((s) => s.user)
  const router = useRouter()
  const [order, setOrder] = useState<Order | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user) { router.push("/login"); return }
    api.get<Order>(`/api/orders/${id}`)
      .then(setOrder)
      .catch(() => setOrder(null))
      .finally(() => setLoading(false))
  }, [id, user, router])

  if (loading) return <div className="flex justify-center py-20 text-slate-400">Loading…</div>
  if (!order) return <div className="flex justify-center py-20 text-slate-400">Order not found</div>

  return (
    <div className="max-w-2xl mx-auto px-4 py-10">
      <Link href="/account" className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-800 mb-6">
        <ArrowLeft size={14} /> Back to account
      </Link>

      <OrderDetailCard order={order} />
    </div>
  )
}

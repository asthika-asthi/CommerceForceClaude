"use client"
import { Suspense, useEffect, useState } from "react"
import Link from "next/link"
import { useSearchParams } from "next/navigation"
import { api } from "@/lib/api"

export default function VerifyEmailPage() {
  return (
    <Suspense fallback={null}>
      <VerifyEmailContent />
    </Suspense>
  )
}

function VerifyEmailContent() {
  const searchParams = useSearchParams()
  const token = searchParams.get("token") ?? ""
  const [status, setStatus] = useState<"verifying" | "success" | "error" | "no-token">(
    token ? "verifying" : "no-token",
  )
  const [errorMsg, setErrorMsg] = useState("")

  useEffect(() => {
    if (!token) return
    api
      .get(`/api/auth/verify-email?token=${encodeURIComponent(token)}`)
      .then(() => setStatus("success"))
      .catch((err: unknown) => {
        setStatus("error")
        setErrorMsg(err instanceof Error ? err.message : "Verification failed.")
      })
  }, [token])

  if (status === "no-token") {
    return (
      <Shell>
        <Icon color="text-slate-400" bg="bg-slate-100">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </Icon>
        <h1 className="text-xl font-bold text-slate-900 mb-2">Invalid link</h1>
        <p className="text-sm text-slate-500 mb-6">
          This verification link is missing a token. Please use the link from your registration email.
        </p>
        <Link href="/" className="text-brand-dark hover:underline text-sm font-medium">Back to home</Link>
      </Shell>
    )
  }

  if (status === "verifying") {
    return (
      <Shell>
        <div className="w-10 h-10 border-2 border-brand border-t-transparent rounded-full animate-spin mx-auto mb-6" />
        <p className="text-slate-500 text-sm">Verifying your email address…</p>
      </Shell>
    )
  }

  if (status === "success") {
    return (
      <Shell>
        <Icon color="text-green-600" bg="bg-green-100">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
        </Icon>
        <h1 className="text-xl font-bold text-slate-900 mb-2">Email verified</h1>
        <p className="text-sm text-slate-500 mb-6">
          Your email address has been confirmed. You&apos;re all set!
        </p>
        <div className="flex gap-3 justify-center">
          <Link
            href="/account"
            className="inline-block bg-brand hover:bg-brand-hover text-white font-semibold px-6 py-2.5 rounded-lg transition-colors text-sm"
          >
            Go to my account
          </Link>
          <Link
            href="/products"
            className="inline-block border border-slate-200 text-slate-700 hover:bg-slate-50 font-semibold px-6 py-2.5 rounded-lg transition-colors text-sm"
          >
            Shop now
          </Link>
        </div>
      </Shell>
    )
  }

  // error
  const expired = errorMsg.toLowerCase().includes("expired")
  return (
    <Shell>
      <Icon color="text-red-500" bg="bg-red-100">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
      </Icon>
      <h1 className="text-xl font-bold text-slate-900 mb-2">
        {expired ? "Link expired" : "Verification failed"}
      </h1>
      <p className="text-sm text-slate-500 mb-6">
        {expired
          ? "This verification link has expired (links are valid for 24 hours). Please create a new account or contact us."
          : errorMsg || "Something went wrong. Please try again or contact us."}
      </p>
      <Link href="/" className="text-brand-dark hover:underline text-sm font-medium">Back to home</Link>
    </Shell>
  )
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-[60vh] flex items-center justify-center px-4 py-16">
      <div className="w-full max-w-sm text-center">{children}</div>
    </div>
  )
}

function Icon({ color, bg, children }: { color: string; bg: string; children: React.ReactNode }) {
  return (
    <div className={`w-14 h-14 ${bg} rounded-full flex items-center justify-center mx-auto mb-4`}>
      <svg className={`w-7 h-7 ${color}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
        {children}
      </svg>
    </div>
  )
}

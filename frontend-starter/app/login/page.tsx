"use client"
import { Suspense, useState } from "react"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { useAuthStore } from "@/store/auth"
import { PasswordInput } from "@/components/password-input"
import { api } from "@/lib/api"

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  )
}

function LoginForm() {
  const login = useAuthStore((s) => s.login)
  const verifyTwoFactor = useAuthStore((s) => s.verifyTwoFactor)
  const resendTwoFactor = useAuthStore((s) => s.resendTwoFactor)
  const router = useRouter()
  const searchParams = useSearchParams()
  const redirect = searchParams.get("redirect") ?? "/account"
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)
  const [needsVerification, setNeedsVerification] = useState(false)
  const [resendMsg, setResendMsg] = useState("")

  // Second step (only shown when the account has 2FA enabled)
  const [twoFactor, setTwoFactor] = useState(false)
  const [code, setCode] = useState("")
  const [codeResent, setCodeResent] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError("")
    setNeedsVerification(false)
    setResendMsg("")
    setLoading(true)
    try {
      const needsCode = await login(email, password)
      if (needsCode) {
        setTwoFactor(true)
      } else {
        router.push(redirect)
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Login failed"
      setError(msg)
      if (/verify your email/i.test(msg)) setNeedsVerification(true)
    } finally {
      setLoading(false)
    }
  }

  async function handleVerify(e: React.FormEvent) {
    e.preventDefault()
    setError("")
    setLoading(true)
    try {
      await verifyTwoFactor(code.trim())
      router.push(redirect)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Verification failed")
    } finally {
      setLoading(false)
    }
  }

  async function handleResendCode() {
    setError("")
    setCodeResent(false)
    try {
      await resendTwoFactor()
      setCodeResent(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't resend the code")
    }
  }

  async function resendVerification() {
    setResendMsg("")
    try {
      await api.post("/api/auth/resend-verification", { email })
      setResendMsg("Verification email sent — please check your inbox.")
    } catch {
      setResendMsg("Verification email sent — please check your inbox.")
    }
  }

  return (
    <div className="min-h-[60vh] flex items-center justify-center px-4 py-16">
      <div className="w-full max-w-sm">
        <h1 className="text-2xl font-bold text-slate-900 mb-6 text-center">
          {twoFactor ? "Enter your code" : "Sign in"}
        </h1>

        {!twoFactor ? (
          <>
            <form onSubmit={handleSubmit} className="space-y-4">
              {error && <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-3 py-2">{error}</div>}
              {needsVerification && (
                <div className="text-sm text-slate-600">
                  <button type="button" onClick={resendVerification} className="text-brand-dark font-medium hover:underline">
                    Resend verification email
                  </button>
                  {resendMsg && <p className="mt-1 text-green-600">{resendMsg}</p>}
                </div>
              )}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Email</label>
                <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-dark" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Password</label>
                <PasswordInput required value={password} onChange={(e) => setPassword(e.target.value)}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-dark" />
              </div>
              <button type="submit" disabled={loading}
                className="w-full bg-brand hover:bg-brand-hover text-on-brand font-semibold py-2.5 rounded-lg transition-colors disabled:opacity-50">
                {loading ? "Signing in…" : "Sign in"}
              </button>
            </form>
            <div className="mt-4 text-center">
              <Link href="/forgot-password" className="text-sm text-brand-dark hover:underline">
                Forgot your password?
              </Link>
            </div>
            <p className="text-center text-sm text-slate-500 mt-3">
              Don&apos;t have an account?{" "}
              <Link href="/register" className="text-brand-dark hover:underline font-medium">Register</Link>
            </p>
          </>
        ) : (
          <form onSubmit={handleVerify} className="space-y-4">
            {error && <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-3 py-2">{error}</div>}
            {codeResent && !error && (
              <div className="bg-green-50 border border-green-200 text-green-700 text-sm rounded-lg px-3 py-2">
                A new code is on its way.
              </div>
            )}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Verification code</label>
              <input type="text" inputMode="numeric" autoComplete="one-time-code" maxLength={6} required autoFocus
                value={code} onChange={(e) => setCode(e.target.value)}
                placeholder="000000"
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm tracking-[0.5em] text-center focus:outline-none focus:ring-2 focus:ring-brand-dark" />
              <p className="text-xs text-slate-500 mt-1">
                We emailed a 6-digit code to {email}. It expires in 10 minutes.
              </p>
            </div>
            <button type="submit" disabled={loading}
              className="w-full bg-brand hover:bg-brand-hover text-on-brand font-semibold py-2.5 rounded-lg transition-colors disabled:opacity-50">
              {loading ? "Verifying…" : "Verify and sign in"}
            </button>
            <button type="button" onClick={handleResendCode}
              className="w-full text-sm text-brand-dark hover:underline">
              Resend code
            </button>
          </form>
        )}
      </div>
    </div>
  )
}

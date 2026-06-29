"use client"
import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { useAuthStore } from "@/store/auth"
import { api } from "@/lib/api"
import type { User } from "@/lib/types"
import { ArrowLeft } from "lucide-react"
import { PasswordInput } from "@/components/password-input"

export default function AccountSettingsPage() {
  const user = useAuthStore((s) => s.user)
  const isLoading = useAuthStore((s) => s.isLoading)
  const setUser = useAuthStore((s) => s.setUser)
  const router = useRouter()
  const [form, setForm] = useState({ first_name: "", last_name: "", phone: "", company_name: "" })
  const [loading, setLoading] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState("")

  const [pwForm, setPwForm] = useState({ current_password: "", new_password: "", confirm_password: "" })
  const [pwLoading, setPwLoading] = useState(false)
  const [pwSaved, setPwSaved] = useState(false)
  const [pwError, setPwError] = useState("")

  // Redirect guard — waits for auth to hydrate
  useEffect(() => {
    if (isLoading) return
    if (!user) router.push("/login")
  }, [user, isLoading, router])

  // Form init — only on first load (keyed on user?.id)
  useEffect(() => {
    if (!user) return
    setForm({
      first_name: user.first_name ?? "",
      last_name: user.last_name ?? "",
      phone: user.phone ?? "",
      company_name: user.company_name ?? "",
    })
  }, [user?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError("")
    setLoading(true)
    try {
      const updated = await api.put<User>("/api/auth/me", form)
      if (setUser) setUser(updated)
      setSaved(true)
      setTimeout(() => setSaved(false), 2500)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Update failed")
    } finally {
      setLoading(false)
    }
  }

  async function handlePasswordSubmit(e: React.FormEvent) {
    e.preventDefault()
    setPwError("")
    if (pwForm.new_password !== pwForm.confirm_password) {
      setPwError("Passwords do not match")
      return
    }
    setPwLoading(true)
    try {
      await api.post("/api/auth/me/change-password", {
        current_password: pwForm.current_password,
        new_password: pwForm.new_password,
      })
      setPwForm({ current_password: "", new_password: "", confirm_password: "" })
      setPwSaved(true)
      setTimeout(() => setPwSaved(false), 2500)
    } catch (err) {
      setPwError(err instanceof Error ? err.message : "Password change failed")
    } finally {
      setPwLoading(false)
    }
  }

  if (isLoading || !user) return <div className="flex justify-center py-20 text-slate-400">Loading…</div>

  return (
    <div className="max-w-lg mx-auto px-4 py-10">
      <Link href="/account" className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-800 mb-6">
        <ArrowLeft size={14} /> Back to account
      </Link>
      <h1 className="text-2xl font-bold text-slate-900 mb-6">Profile settings</h1>

      <form onSubmit={handleSubmit} className="bg-white border border-slate-100 rounded-2xl p-6 space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">First name</label>
            <input value={form.first_name} onChange={(e) => setForm((f) => ({ ...f, first_name: e.target.value }))}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-dark" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Last name</label>
            <input value={form.last_name} onChange={(e) => setForm((f) => ({ ...f, last_name: e.target.value }))}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-dark" />
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Phone</label>
          <input value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
            placeholder="Optional"
            className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-dark" />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Company</label>
          <input value={form.company_name} onChange={(e) => setForm((f) => ({ ...f, company_name: e.target.value }))}
            placeholder="Optional"
            className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-dark" />
        </div>
        {error && <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-3 py-2">{error}</div>}
        <button type="submit" disabled={loading}
          className={`w-full py-2.5 rounded-xl font-semibold text-sm transition-colors disabled:opacity-50 ${
            saved ? "bg-green-600 text-white" : "bg-brand hover:bg-brand-hover text-white"
          }`}>
          {loading ? "Saving…" : saved ? "Saved!" : "Save changes"}
        </button>
      </form>

      <h2 className="text-xl font-bold text-slate-900 mt-10 mb-4">Change password</h2>
      <form onSubmit={handlePasswordSubmit} className="bg-white border border-slate-100 rounded-2xl p-6 space-y-4">
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Current password</label>
          <PasswordInput required value={pwForm.current_password}
            onChange={(e) => setPwForm((f) => ({ ...f, current_password: e.target.value }))}
            className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-dark" />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">New password</label>
          <PasswordInput required minLength={8} value={pwForm.new_password}
            onChange={(e) => setPwForm((f) => ({ ...f, new_password: e.target.value }))}
            className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-dark" />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Confirm new password</label>
          <PasswordInput required minLength={8} value={pwForm.confirm_password}
            onChange={(e) => setPwForm((f) => ({ ...f, confirm_password: e.target.value }))}
            className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-dark" />
        </div>
        {pwError && <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-3 py-2">{pwError}</div>}
        <button type="submit" disabled={pwLoading}
          className={`w-full py-2.5 rounded-xl font-semibold text-sm transition-colors disabled:opacity-50 ${
            pwSaved ? "bg-green-600 text-white" : "bg-brand hover:bg-brand-hover text-white"
          }`}>
          {pwLoading ? "Changing…" : pwSaved ? "Password changed!" : "Change password"}
        </button>
      </form>
    </div>
  )
}

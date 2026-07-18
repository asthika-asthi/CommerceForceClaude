"use client"
import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { useAuthStore } from "@/store/auth"
import { api } from "@/lib/api"
import type { User, DeletionRequest } from "@/lib/types"
import { ArrowLeft } from "lucide-react"
import { PasswordInput } from "@/components/password-input"
import { ConfirmDialog } from "@/components/confirm-dialog"

const DELETION_STATUS_COPY: Record<DeletionRequest["status"], string> = {
  pending: "Your deletion request is pending review — we'll respond within 30 days.",
  approved: "Your deletion request has been approved and is being processed.",
  rejected: "Your deletion request was reviewed and not actioned. Contact support if you have questions.",
  completed: "Your account has been deleted.",
}

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

  const [exporting, setExporting] = useState(false)
  const [exportError, setExportError] = useState("")
  const [deletionRequest, setDeletionRequest] = useState<DeletionRequest | null>(null)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [deleteError, setDeleteError] = useState("")

  // Redirect guard — waits for auth to hydrate
  useEffect(() => {
    if (isLoading) return
    if (!user) router.push("/login")
  }, [user, isLoading, router])

  // Form init — only on first load (keyed on user?.id)
  useEffect(() => {
    if (!user) return
    // eslint-disable-next-line react-hooks/set-state-in-effect -- correct one-time form init from user on mount; proper refactor tracked in backlog "Storefront lint debt"
    setForm({
      first_name: user.first_name ?? "",
      last_name: user.last_name ?? "",
      phone: user.phone ?? "",
      company_name: user.company_name ?? "",
    })
  }, [user?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!user) return
    api.get<DeletionRequest | null>("/api/auth/me/deletion-request").then(setDeletionRequest).catch(() => {})
  }, [user?.id])

  async function handleExportData() {
    setExportError("")
    setExporting(true)
    try {
      await api.download("/api/auth/me/export-data", "my-data.json")
    } catch (err) {
      setExportError(err instanceof Error ? err.message : "Download failed")
    } finally {
      setExporting(false)
    }
  }

  async function handleConfirmDelete() {
    setDeleteError("")
    try {
      const req = await api.post<DeletionRequest>("/api/auth/me/deletion-request")
      setDeletionRequest(req)
      setShowDeleteConfirm(false)
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : "Could not submit request")
      setShowDeleteConfirm(false)
    }
  }

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
            saved ? "bg-green-600 text-white" : "bg-brand hover:bg-brand-hover text-on-brand"
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
            pwSaved ? "bg-green-600 text-white" : "bg-brand hover:bg-brand-hover text-on-brand"
          }`}>
          {pwLoading ? "Changing…" : pwSaved ? "Password changed!" : "Change password"}
        </button>
      </form>

      <h2 className="text-xl font-bold text-slate-900 mt-10 mb-4">Privacy</h2>
      <div className="bg-white border border-slate-100 rounded-2xl p-6 space-y-5">
        <div>
          <p className="text-sm font-medium text-slate-800 mb-1">Download my data</p>
          <p className="text-xs text-slate-500 mb-3">
            Get a copy of everything we hold against your account — orders, addresses, reviews and more — as a JSON file.
          </p>
          <button type="button" onClick={handleExportData} disabled={exporting}
            className="px-4 py-2 rounded-lg text-sm font-medium border border-slate-200 text-slate-700 hover:bg-slate-50 disabled:opacity-50">
            {exporting ? "Preparing…" : "Download my data"}
          </button>
          {exportError && <p className="text-xs text-red-600 mt-2">{exportError}</p>}
        </div>

        <div className="pt-5 border-t border-slate-100">
          <p className="text-sm font-medium text-slate-800 mb-1">Delete my account</p>
          {deletionRequest ? (
            <p className="text-xs text-slate-600">{DELETION_STATUS_COPY[deletionRequest.status]}</p>
          ) : (
            <>
              <p className="text-xs text-slate-500 mb-3">
                Request permanent deletion of your account. An admin will review the request — we&apos;ll respond within 30 days.
              </p>
              <button type="button" onClick={() => setShowDeleteConfirm(true)}
                className="px-4 py-2 rounded-lg text-sm font-medium border border-red-200 text-red-600 hover:bg-red-50">
                Delete my account
              </button>
            </>
          )}
          {deleteError && <p className="text-xs text-red-600 mt-2">{deleteError}</p>}
        </div>
      </div>

      <ConfirmDialog
        open={showDeleteConfirm}
        title="Delete your account?"
        description="This submits a request to permanently delete your account. An admin will review it before anything happens — we'll respond within 30 days. Your order history is kept for legal/accounting purposes but stripped of personal details."
        confirmLabel="Submit request"
        destructive
        onConfirm={handleConfirmDelete}
        onCancel={() => setShowDeleteConfirm(false)}
      />
    </div>
  )
}

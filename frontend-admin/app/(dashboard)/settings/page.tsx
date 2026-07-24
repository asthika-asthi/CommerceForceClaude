"use client"
import { useState } from "react"
import { api } from "@/lib/api"
import { PageHeader } from "@/components/page-header"
import { PasswordInput } from "@/components/password-input"
import { useAuthStore } from "@/store/auth"
import type { User } from "@/lib/types"

function TwoFactorSection() {
  const user = useAuthStore((s) => s.user)
  const setUser = useAuthStore((s) => s.setUser)
  const enabled = !!user?.is_2fa_enabled

  // "idle" → showing the enable/disable button; "confirm" → code entry (enrolling);
  // "disable" → password entry (turning off).
  const [mode, setMode] = useState<"idle" | "confirm" | "disable">("idle")
  const [code, setCode] = useState("")
  const [password, setPassword] = useState("")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")
  const [notice, setNotice] = useState("")

  const inputCls = "w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"

  async function startEnable() {
    setError(""); setNotice(""); setBusy(true)
    try {
      await api.post("/api/auth/2fa/setup")
      setMode("confirm")
      setNotice("We emailed you a 6-digit code. Enter it below to finish enabling two-factor.")
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't start setup")
    } finally { setBusy(false) }
  }

  async function confirmEnable(e: React.FormEvent) {
    e.preventDefault(); setError(""); setBusy(true)
    try {
      const updated = await api.post<User>("/api/auth/2fa/confirm", { code: code.trim() })
      setUser(updated)
      setMode("idle"); setCode(""); setNotice("Two-factor authentication is now on.")
    } catch (err) {
      setError(err instanceof Error ? err.message : "That code wasn't right")
    } finally { setBusy(false) }
  }

  async function confirmDisable(e: React.FormEvent) {
    e.preventDefault(); setError(""); setBusy(true)
    try {
      const updated = await api.post<User>("/api/auth/2fa/disable", { password })
      setUser(updated)
      setMode("idle"); setPassword(""); setNotice("Two-factor authentication is now off.")
    } catch (err) {
      setError(err instanceof Error ? err.message : "Password was incorrect")
    } finally { setBusy(false) }
  }

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-6 mt-6">
      <h2 className="text-sm font-semibold text-slate-700 mb-1">Two-factor authentication</h2>
      <p className="text-xs text-slate-500 mb-4">
        {enabled
          ? "On — each sign-in also requires a code emailed to you."
          : "Off — add a code emailed to you at each sign-in for extra security."}
      </p>

      {notice && !error && (
        <div className="mb-4 bg-green-50 border border-green-200 text-green-700 text-sm rounded-lg px-3 py-2">{notice}</div>
      )}
      {error && (
        <div className="mb-4 bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-3 py-2">{error}</div>
      )}

      {mode === "idle" && !enabled && (
        <button onClick={startEnable} disabled={busy}
          className="bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium py-2 px-4 rounded-lg transition-colors disabled:opacity-50">
          {busy ? "Sending code…" : "Enable two-factor"}
        </button>
      )}

      {mode === "idle" && enabled && (
        <button onClick={() => { setMode("disable"); setNotice(""); setError("") }}
          className="border border-slate-300 text-slate-700 hover:bg-slate-50 text-sm font-medium py-2 px-4 rounded-lg transition-colors">
          Turn off two-factor
        </button>
      )}

      {mode === "confirm" && (
        <form onSubmit={confirmEnable} className="space-y-3">
          <input type="text" inputMode="numeric" autoComplete="one-time-code" maxLength={6}
            value={code} onChange={(e) => setCode(e.target.value)} required autoFocus
            placeholder="000000" className={`${inputCls} tracking-[0.4em] text-center`} />
          <div className="flex gap-2">
            <button type="submit" disabled={busy}
              className="bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium py-2 px-4 rounded-lg transition-colors disabled:opacity-50">
              {busy ? "Verifying…" : "Confirm"}
            </button>
            <button type="button" onClick={() => { setMode("idle"); setCode(""); setNotice("") }}
              className="text-sm text-slate-500 hover:text-slate-700 py-2 px-2">Cancel</button>
          </div>
        </form>
      )}

      {mode === "disable" && (
        <form onSubmit={confirmDisable} className="space-y-3">
          <p className="text-xs text-slate-600">Enter your password to turn two-factor off.</p>
          <PasswordInput value={password} onChange={(e) => setPassword(e.target.value)} required autoFocus className={inputCls} />
          <div className="flex gap-2">
            <button type="submit" disabled={busy}
              className="bg-red-600 hover:bg-red-700 text-white text-sm font-medium py-2 px-4 rounded-lg transition-colors disabled:opacity-50">
              {busy ? "Turning off…" : "Turn off"}
            </button>
            <button type="button" onClick={() => { setMode("idle"); setPassword("") }}
              className="text-sm text-slate-500 hover:text-slate-700 py-2 px-2">Cancel</button>
          </div>
        </form>
      )}
    </div>
  )
}

export default function SettingsPage() {
  const [form, setForm] = useState({ current_password: "", new_password: "", confirm_password: "" })
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle")
  const [errorMsg, setErrorMsg] = useState("")

  function set(key: string) {
    return (e: React.ChangeEvent<HTMLInputElement>) =>
      setForm((f) => ({ ...f, [key]: e.target.value }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setErrorMsg("")

    if (form.new_password.length < 8) {
      setErrorMsg("New password must be at least 8 characters.")
      return
    }
    if (form.new_password !== form.confirm_password) {
      setErrorMsg("New passwords do not match.")
      return
    }

    setStatus("loading")
    try {
      await api.post("/api/auth/me/change-password", {
        current_password: form.current_password,
        new_password: form.new_password,
      })
      setStatus("success")
      setForm({ current_password: "", new_password: "", confirm_password: "" })
    } catch (err) {
      setStatus("error")
      setErrorMsg(err instanceof Error ? err.message : "Something went wrong.")
    }
  }

  const inputCls = "w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"

  return (
    <div className="max-w-md">
      <PageHeader title="Settings" />

      <div className="bg-white border border-slate-200 rounded-xl p-6 mt-6">
        <h2 className="text-sm font-semibold text-slate-700 mb-4">Change Password</h2>

        {status === "success" && (
          <div className="mb-4 bg-green-50 border border-green-200 text-green-700 text-sm rounded-lg px-3 py-2">
            Password changed successfully.
          </div>
        )}
        {status === "error" && (
          <div className="mb-4 bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-3 py-2">
            {errorMsg}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Current password</label>
            <PasswordInput
              required
              value={form.current_password}
              onChange={set("current_password")}
              className={inputCls}
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">New password</label>
            <PasswordInput
              required
              value={form.new_password}
              onChange={set("new_password")}
              className={inputCls}
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Confirm new password</label>
            <PasswordInput
              required
              value={form.confirm_password}
              onChange={set("confirm_password")}
              className={inputCls}
            />
          </div>
          {errorMsg && status !== "error" && (
            <p className="text-red-600 text-xs">{errorMsg}</p>
          )}
          <button
            type="submit"
            disabled={status === "loading"}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium py-2 rounded-lg transition-colors disabled:opacity-50"
          >
            {status === "loading" ? "Updating…" : "Update password"}
          </button>
        </form>
      </div>

      <TwoFactorSection />
    </div>
  )
}

"use client"
import { useState } from "react"
import { api } from "@/lib/api"
import { PageHeader } from "@/components/page-header"
import { PasswordInput } from "@/components/password-input"

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
    </div>
  )
}

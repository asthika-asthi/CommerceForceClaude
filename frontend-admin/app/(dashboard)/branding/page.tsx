"use client"
import { useEffect, useRef, useState } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { api } from "@/lib/api"
import type { BrandingConfig } from "@/lib/types"
import { PageHeader } from "@/components/page-header"
import { Upload, X, RotateCcw, AlertTriangle } from "lucide-react"
import {
  CORE_COLOR_META,
  FAMILY_RULES,
  ALL_DERIVED_TOKENS,
  contrastRatio,
  onColor,
  isValidHex,
  type CoreKey,
} from "@/lib/theme-colors"

const TEXT_FIELDS = [
  { key: "store_name", label: "Store Name", placeholder: "My Store" },
  { key: "tagline", label: "Tagline", placeholder: "Your store tagline" },
  { key: "font_family", label: "Font Family", placeholder: "Inter" },
  { key: "contact_email", label: "Contact Email", placeholder: "hello@store.com" },
  { key: "contact_phone", label: "Contact Phone", placeholder: "+1 555-0100" },
  { key: "stripe_publishable_key", label: "Stripe Publishable Key", placeholder: "pk_live_..." },
]

const IMAGE_FIELDS = [
  { key: "logo_url", label: "Logo", hint: "PNG/SVG, transparent background recommended" },
  { key: "favicon_url", label: "Favicon", hint: "32×32 or 64×64 ICO/PNG" },
]

const GA4_ID_RE = /^G-[A-Z0-9]+$/
const PIXEL_ID_RE = /^\d{5,20}$/

type FormState = Partial<Record<string, string>>
type CoreState = Partial<Record<CoreKey, string>>
type OverrideState = Record<string, string>

function ImageUploadField({
  label, hint, value, onChange,
}: { label: string; hint: string; value: string; onChange: (url: string) => void }) {
  const fileRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleFile(file: File) {
    setError(null)
    setUploading(true)
    try {
      const fd = new FormData()
      fd.append("file", file)
      const result = await api.upload<{ url: string }>("/api/media/upload", fd)
      onChange(result.url)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Upload failed")
    } finally {
      setUploading(false)
    }
  }

  return (
    <div className="col-span-2">
      <label className="block text-sm font-medium text-slate-700 mb-1">{label}</label>
      <p className="text-xs text-slate-500 mb-2">{hint}</p>
      <div className="flex items-start gap-3">
        {value && (
          <div className="relative flex-shrink-0">
            <img src={value} alt={label} className="h-14 w-auto max-w-[120px] object-contain rounded border border-slate-200 bg-slate-50 p-1" />
            <button type="button" onClick={() => onChange("")}
              className="absolute -top-1.5 -right-1.5 bg-white border border-slate-200 rounded-full p-0.5 hover:bg-red-50 hover:border-red-300">
              <X className="w-3 h-3 text-slate-500 hover:text-red-500" />
            </button>
          </div>
        )}
        <div className="flex-1 space-y-2">
          <button type="button" disabled={uploading}
            onClick={() => fileRef.current?.click()}
            className="flex items-center gap-2 px-3 py-2 text-sm border border-dashed border-slate-300 rounded-lg hover:border-blue-400 hover:bg-blue-50 disabled:opacity-50 transition-colors">
            <Upload className="w-4 h-4" />
            {uploading ? "Uploading…" : "Upload image"}
          </button>
          <input type="text" value={value}
            onChange={(e) => onChange(e.target.value)}
            className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="Or paste a URL" />
          {error && <p className="text-xs text-red-500">{error}</p>}
        </div>
      </div>
      <input ref={fileRef} type="file" accept="image/*" className="hidden"
        onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); e.target.value = "" }} />
    </div>
  )
}

function ColorPickerRow({
  value, placeholder, onChange, onReset, resetTitle,
}: { value: string; placeholder: string; onChange: (v: string) => void; onReset?: () => void; resetTitle?: string }) {
  return (
    <div className="flex items-center gap-2">
      <input type="color" value={isValidHex(value) ? value : "#888888"}
        onChange={(e) => onChange(e.target.value)}
        className="h-9 w-12 cursor-pointer rounded border border-slate-300" />
      <input value={value}
        onChange={(e) => onChange(e.target.value)}
        className="flex-1 border border-slate-300 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
        placeholder={placeholder} />
      {onReset && value && (
        <button type="button" onClick={onReset} title={resetTitle ?? "Reset to automatic"}
          className="p-2 rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50 hover:text-slate-700">
          <RotateCcw className="w-3.5 h-3.5" />
        </button>
      )}
    </div>
  )
}

/** Contrast warnings for the currently chosen core colours. */
function contrastWarnings(core: CoreState): string[] {
  const warnings: string[] = []
  const brand = core.brand
  if (brand && isValidHex(brand) && contrastRatio(brand, onColor(brand)) < 3) {
    warnings.push("The main brand colour has low contrast even with automatic button text — buttons may be hard to read.")
  }
  const text = core.text
  const bg = core.background
  if (text && bg && isValidHex(text) && isValidHex(bg) && contrastRatio(text, bg) < 4.5) {
    warnings.push("Text colour on the page background is below the recommended readability contrast (4.5:1).")
  }
  const dark = core.dark
  if (dark && isValidHex(dark)) {
    const onDark = FAMILY_RULES.dark.derived.find((d) => d.token === "on-dark")!.derive(dark)
    if (contrastRatio(dark, onDark) < 4.5) {
      warnings.push("The dark/emphasis colour is too light — text on dark sections may be hard to read. Pick a darker shade or override the on-dark colours under Advanced.")
    }
  }
  return warnings
}

export default function BrandingPage() {
  const qc = useQueryClient()
  const { data: config, isLoading } = useQuery<BrandingConfig>({
    queryKey: ["branding"],
    queryFn: () => api.get("/api/branding"),
  })
  const [form, setForm] = useState<FormState>({})
  const [core, setCore] = useState<CoreState>({})
  const [overrides, setOverrides] = useState<OverrideState>({})
  const [saved, setSaved] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)

  useEffect(() => {
    if (config) {
      const f: FormState = {}
      TEXT_FIELDS.forEach(({ key }) => { f[key] = (config as unknown as Record<string, string>)[key] ?? "" })
      IMAGE_FIELDS.forEach(({ key }) => { f[key] = (config as unknown as Record<string, string>)[key] ?? "" })
      f.custom_css = config.custom_css ?? ""
      f.bank_transfer_details = config.bank_transfer_details ?? ""
      f.paypal_email = config.paypal_email ?? ""
      f.ga4_measurement_id = config.ga4_measurement_id ?? ""
      f.meta_pixel_id = config.meta_pixel_id ?? ""
      const sl = (config as unknown as Record<string, unknown>).social_links
      f.social_links = sl && typeof sl === "object" ? JSON.stringify(sl) : (sl as string | null) ?? ""
      setForm(f)
      setCore((config.theme_colors?.core ?? {}) as CoreState)
      setOverrides(config.theme_colors?.overrides ?? {})
    }
  }, [config])

  const update = useMutation({
    mutationFn: (d: FormState) => {
      const cleanCore: Record<string, string> = {}
      for (const [k, v] of Object.entries(core)) if (v && isValidHex(v)) cleanCore[k] = v.trim()
      const cleanOverrides: Record<string, string> = {}
      for (const [k, v] of Object.entries(overrides)) if (v && isValidHex(v)) cleanOverrides[k] = v.trim()
      const theme_colors =
        Object.keys(cleanCore).length || Object.keys(cleanOverrides).length
          ? { core: cleanCore, overrides: cleanOverrides }
          : {}
      return api.put("/api/branding", { ...d, theme_colors })
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["branding"] })
      setSaveError(null)
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    },
    onError: (err: unknown) => {
      const msg = err instanceof Error ? err.message : "Save failed. Please try again."
      setSaved(false)
      setSaveError(msg)
      setTimeout(() => setSaveError(null), 4000)
    },
  })

  if (isLoading) {
    return <div className="flex justify-center py-12"><div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" /></div>
  }

  const warnings = contrastWarnings(core)
  const anyColourSet = Object.values(core).some(Boolean) || Object.values(overrides).some(Boolean)

  return (
    <div className="max-w-2xl">
      <PageHeader title="Branding" description="Storefront identity and visual settings" />
      <form onSubmit={(e) => { e.preventDefault(); update.mutate(form) }}
        className="bg-white rounded-xl border border-slate-200 p-6 space-y-5">

        <div className="grid grid-cols-2 gap-5">
          {TEXT_FIELDS.map(({ key, label, placeholder }) => (
            <div key={key}>
              <label className="block text-sm font-medium text-slate-700 mb-1">{label}</label>
              <input value={form[key] || ""}
                onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder={placeholder} />
            </div>
          ))}
        </div>

        {/* ── Colours ─────────────────────────────────────────────── */}
        <div className="pt-4 border-t border-slate-100">
          <div className="flex items-center justify-between mb-1">
            <h3 className="text-sm font-semibold text-slate-800">Colours</h3>
            {anyColourSet && (
              <button type="button"
                onClick={() => { setCore({}); setOverrides({}) }}
                className="text-xs text-slate-500 hover:text-red-600 flex items-center gap-1">
                <RotateCcw className="w-3 h-3" /> Reset all colours to theme defaults
              </button>
            )}
          </div>
          <p className="text-xs text-slate-500 mb-4">
            Pick the core colours below — hover shades and light tints are worked out automatically.
            Leave a colour empty to keep the theme&apos;s default. Fine-tune any automatic shade under Advanced.
          </p>

          <div className="space-y-4">
            {CORE_COLOR_META.map(({ key, label, hint }) => {
              const value = core[key] ?? ""
              const valid = value && isValidHex(value)
              const rules = FAMILY_RULES[key]
              return (
                <div key={key}>
                  <label className="block text-sm font-medium text-slate-700">{label}</label>
                  <p className="text-xs text-slate-400 mb-1.5">{hint}</p>
                  <ColorPickerRow
                    value={value}
                    placeholder="Theme default"
                    onChange={(v) => setCore((c) => ({ ...c, [key]: v }))}
                    onReset={() => setCore((c) => { const n = { ...c }; delete n[key]; return n })}
                    resetTitle="Use theme default"
                  />
                  {valid && rules.derived.length > 0 && (
                    <div className="flex items-center gap-1.5 mt-1.5 ml-1">
                      <span className="text-[10px] text-slate-400 uppercase tracking-wide mr-1">Auto shades:</span>
                      {rules.derived.map((d) => {
                        const shade = overrides[d.token] && isValidHex(overrides[d.token]) ? overrides[d.token] : d.derive(value)
                        return (
                          <span key={d.token} title={`${d.label}: ${shade}${overrides[d.token] ? " (overridden)" : ""}`}
                            className="w-5 h-5 rounded border border-slate-200 inline-block"
                            style={{ background: shade }} />
                        )
                      })}
                    </div>
                  )}
                </div>
              )
            })}
          </div>

          {warnings.length > 0 && (
            <div className="mt-4 space-y-1.5">
              {warnings.map((w) => (
                <p key={w} className="flex items-start gap-1.5 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                  <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0 mt-px" /> {w}
                </p>
              ))}
            </div>
          )}

          <details className="mt-4 group">
            <summary className="text-xs font-medium text-slate-600 cursor-pointer select-none hover:text-slate-800">
              Advanced — override individual shades
            </summary>
            <div className="mt-3 space-y-3 pl-1">
              <p className="text-xs text-slate-400">
                Each shade below is computed automatically from its core colour. Set a value to override it;
                use the reset button to go back to automatic.
              </p>
              {ALL_DERIVED_TOKENS.map(({ family, token, label, derive }) => {
                const coreValue = core[family]
                const auto = coreValue && isValidHex(coreValue) ? derive(coreValue) : null
                return (
                  <div key={token} className="grid grid-cols-[1fr_auto] gap-3 items-center">
                    <div>
                      <span className="text-xs font-medium text-slate-600">{label}</span>
                      <span className="block text-[10px] text-slate-400 font-mono">
                        {token} · auto: {auto ?? "theme default"}
                      </span>
                    </div>
                    <div className="w-56">
                      <ColorPickerRow
                        value={overrides[token] ?? ""}
                        placeholder={auto ?? "Automatic"}
                        onChange={(v) => setOverrides((o) => ({ ...o, [token]: v }))}
                        onReset={() => setOverrides((o) => { const n = { ...o }; delete n[token]; return n })}
                      />
                    </div>
                  </div>
                )
              })}
            </div>
          </details>
        </div>

        <div className="grid grid-cols-2 gap-5 pt-1 border-t border-slate-100">
          {IMAGE_FIELDS.map(({ key, label, hint }) => (
            <ImageUploadField key={key} label={label} hint={hint}
              value={form[key] ?? ""}
              onChange={(url) => setForm((f) => ({ ...f, [key]: url }))} />
          ))}
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Social Links (JSON)</label>
          <input value={form.social_links || ""}
            onChange={(e) => setForm((f) => ({ ...f, social_links: e.target.value }))}
            className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder='{"twitter": "https://...", "instagram": "https://..."}' />
        </div>

        {/* ── Payment Methods ─────────────────────────────────────── */}
        <div className="pt-4 border-t border-slate-100">
          <h3 className="text-sm font-semibold text-slate-800 mb-1">Payment Methods</h3>
          <p className="text-xs text-slate-500 mb-4">
            Bank Transfer and PayPal only appear at checkout once their details below are filled in.
            Orders paid this way stay pending until you confirm the payment arrived (Orders → Mark as Paid).
          </p>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Bank Transfer Details</label>
              <textarea value={form.bank_transfer_details || ""}
                onChange={(e) => setForm((f) => ({ ...f, bank_transfer_details: e.target.value }))}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 h-24 resize-none"
                placeholder={"Bank name: ...\nAccount name: ...\nAccount number: ...\nSort code: ..."} />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">PayPal Email</label>
              <input value={form.paypal_email || ""}
                onChange={(e) => setForm((f) => ({ ...f, paypal_email: e.target.value }))}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="payments@yourstore.com" />
            </div>
          </div>
        </div>

        {/* ── Analytics ───────────────────────────────────────────── */}
        <div className="pt-4 border-t border-slate-100">
          <h3 className="text-sm font-semibold text-slate-800 mb-1">Analytics</h3>
          <p className="text-xs text-slate-500 mb-4">
            Optional. Loaded on the storefront only after a visitor accepts cookies in the consent banner.
          </p>
          <div className="grid grid-cols-2 gap-5">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">GA4 Measurement ID</label>
              <input value={form.ga4_measurement_id || ""}
                onChange={(e) => setForm((f) => ({ ...f, ga4_measurement_id: e.target.value }))}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="G-ABC1234567" />
              {form.ga4_measurement_id && !GA4_ID_RE.test(form.ga4_measurement_id.trim()) && (
                <p className="text-xs text-red-600 mt-1">Expected format: G- followed by letters/numbers (e.g. G-ABC1234567)</p>
              )}
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Meta Pixel ID</label>
              <input value={form.meta_pixel_id || ""}
                onChange={(e) => setForm((f) => ({ ...f, meta_pixel_id: e.target.value }))}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="1234567890123" />
              {form.meta_pixel_id && !PIXEL_ID_RE.test(form.meta_pixel_id.trim()) && (
                <p className="text-xs text-red-600 mt-1">Expected format: numbers only (5–20 digits)</p>
              )}
            </div>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Custom CSS</label>
          <textarea value={form.custom_css || ""}
            onChange={(e) => setForm((f) => ({ ...f, custom_css: e.target.value }))}
            className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500 h-28 resize-none"
            placeholder=":root { --brand: #1d4ed8; }" />
        </div>

        <div className="space-y-2">
          <button type="submit" disabled={update.isPending}
            className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-2 rounded-lg text-sm font-medium disabled:opacity-50">
            {update.isPending ? "Saving…" : saved ? "Saved!" : "Save Branding"}
          </button>
          {saveError && <p className="text-sm text-red-600">{saveError}</p>}
        </div>
      </form>
    </div>
  )
}

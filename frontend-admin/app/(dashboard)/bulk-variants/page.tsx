"use client"
import { useState, useRef } from "react"
import type { VariantCsvImportResult } from "@/lib/types"
import { Upload, Download, ChevronDown, ChevronRight } from "lucide-react"

function downloadVariantsCsv() {
  const token = localStorage.getItem("cf_access_token")
  const base = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000"
  fetch(`${base}/api/products/variants/export/csv`, {
    headers: { Authorization: `Bearer ${token}` },
  })
    .then(r => r.blob())
    .then(blob => {
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = "variants.csv"
      a.click()
      URL.revokeObjectURL(url)
    })
    .catch(console.error)
}

export default function BulkVariantsPage() {
  const [stockMode, setStockMode] = useState<"set" | "add">("set")
  const [uploading, setUploading] = useState(false)
  const [result, setResult] = useState<VariantCsvImportResult | null>(null)
  const [warningsOpen, setWarningsOpen] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    setResult(null)
    try {
      const formData = new FormData()
      formData.append("file", file)
      const token = localStorage.getItem("cf_access_token")
      const base = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000"
      const res = await fetch(
        `${base}/api/products/variants/import/csv?stock_mode=${stockMode}`,
        {
          method: "POST",
          body: formData,
          headers: { Authorization: `Bearer ${token}` },
        }
      )
      const data: VariantCsvImportResult = await res.json()
      setResult(data)
    } catch (err) {
      setResult({
        rows_processed: 0,
        variants_created: 0,
        variants_updated: 0,
        stock_records_set: 0,
        stock_records_incremented: 0,
        warnings: [],
        errors: [{ row: 0, field: "network", message: err instanceof Error ? err.message : "Upload failed — please try again" }],
      })
    } finally {
      setUploading(false)
      if (fileRef.current) fileRef.current.value = ""
    }
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">Bulk Variant Import / Export</h1>
      </div>

      {/* Card 1 — Import */}
      <div className="rounded-xl border border-slate-200 bg-white p-6 mb-6">
        <h2 className="text-base font-semibold text-slate-900 mb-1">Import Variants</h2>
        <p className="text-sm text-slate-500 mb-4">
          Upload a CSV to create or update variants across multiple products. Required columns:
          product_sku, variant_sku, option1_name, option1_value … option3_name, option3_value,
          price_adjustment, is_active. Add warehouse stock columns as stock_WAREHOUSE_CODE
          (e.g. stock_MAIN).
        </p>

        {/* Stock mode selector */}
        <div className="mb-4">
          <p className="text-sm font-medium text-slate-700 mb-2">Stock update mode</p>
          <div className="flex items-center gap-6">
            <label className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer">
              <input
                type="radio"
                name="stockMode"
                value="set"
                checked={stockMode === "set"}
                onChange={() => setStockMode("set")}
                className="accent-blue-600"
              />
              Set stock (overwrite)
            </label>
            <label className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer">
              <input
                type="radio"
                name="stockMode"
                value="add"
                checked={stockMode === "add"}
                onChange={() => setStockMode("add")}
                className="accent-blue-600"
              />
              Add stock (increment)
            </label>
          </div>
        </div>

        {/* File upload */}
        <div>
          <input
            ref={fileRef}
            type="file"
            accept=".csv"
            className="hidden"
            onChange={handleFileChange}
          />
          <button
            onClick={() => fileRef.current?.click()}
            disabled={uploading}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg disabled:opacity-50 transition-colors"
          >
            <Upload size={15} />
            {uploading ? "Uploading..." : "Choose CSV file"}
          </button>
        </div>

        {/* Results panel */}
        {result !== null && (
          <div className="mt-5 space-y-3">
            {/* Summary bar */}
            <div
              className={`rounded-lg border px-4 py-3 text-sm ${
                result.errors.length === 0
                  ? "bg-green-50 border-green-200 text-green-800"
                  : "bg-amber-50 border-amber-200 text-amber-800"
              }`}
            >
              {result.rows_processed} rows processed — {result.variants_created} created,{" "}
              {result.variants_updated} updated, {result.stock_records_set} stock records set,{" "}
              {result.stock_records_incremented} incremented
              {result.errors.length > 0 && `, ${result.errors.length} error(s)`}
            </div>

            {/* Warnings (collapsible) */}
            {result.warnings.length > 0 && (
              <div className="rounded-lg border border-amber-200 overflow-hidden">
                <button
                  onClick={() => setWarningsOpen(o => !o)}
                  className="w-full flex items-center gap-2 px-4 py-2.5 bg-amber-50 hover:bg-amber-100 text-left text-sm font-medium text-amber-800 transition-colors"
                >
                  {warningsOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                  Warnings ({result.warnings.length})
                </button>
                {warningsOpen && (
                  <ul className="px-4 py-3 space-y-1 text-xs text-amber-700 list-disc list-inside">
                    {result.warnings.map((w) => (
                      <li key={w}>{w}</li>
                    ))}
                  </ul>
                )}
              </div>
            )}

            {/* Errors table */}
            {result.errors.length > 0 && (
              <div className="rounded-lg border border-red-200 overflow-hidden">
                <table className="w-full text-xs border-collapse">
                  <thead className="bg-red-50 border-b border-red-200">
                    <tr>
                      <th className="px-3 py-2 text-left font-medium text-red-700">Row</th>
                      <th className="px-3 py-2 text-left font-medium text-red-700">Field</th>
                      <th className="px-3 py-2 text-left font-medium text-red-700">Message</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-red-100">
                    {result.errors.map((err, i) => (
                      <tr key={`${err.row}-${err.field}-${err.message}`} className={i % 2 === 0 ? "bg-white" : "bg-red-50"}>
                        <td className="px-3 py-2 text-slate-600 font-mono">{err.row}</td>
                        <td className="px-3 py-2 text-slate-600 font-mono">{err.field}</td>
                        <td className="px-3 py-2 text-slate-700">{err.message}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Card 2 — Export */}
      <div className="rounded-xl border border-slate-200 bg-white p-6">
        <h2 className="text-base font-semibold text-slate-900 mb-1">Export Variants</h2>
        <p className="text-sm text-slate-500 mb-4">
          Downloads all non-default variants across all products in the same CSV format used for
          import. Use this to get a template or to bulk-edit existing variants.
        </p>
        <button
          onClick={downloadVariantsCsv}
          className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium border border-slate-300 text-slate-600 hover:bg-slate-50 transition-colors"
        >
          <Download size={15} />
          Download variants.csv
        </button>
      </div>
    </div>
  )
}

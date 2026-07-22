"use client"
import { useState, useRef, useMemo } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { api } from "@/lib/api"
import { PageHeader } from "@/components/page-header"
import { Trash2, Copy, Upload, Check, LayoutGrid, List, Search } from "lucide-react"

interface MediaFile {
  filename: string
  url: string
  size: number
  modified_at: string
}

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function getFolder(filename: string): string {
  const idx = filename.lastIndexOf("/")
  return idx === -1 ? "" : filename.slice(0, idx)
}

function getBasename(filename: string): string {
  const idx = filename.lastIndexOf("/")
  return idx === -1 ? filename : filename.slice(idx + 1)
}

export default function MediaPage() {
  const qc = useQueryClient()
  const fileRef = useRef<HTMLInputElement>(null)
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null)
  const [copied, setCopied] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState("")
  const [uploadFolder, setUploadFolder] = useState("")
  const [view, setView] = useState<"grid" | "list">("grid")
  const [search, setSearch] = useState("")

  const { data: files = [], isLoading } = useQuery<MediaFile[]>({
    queryKey: ["media-files"],
    queryFn: () => api.get("/api/media/files"),
  })

  const deleteMutation = useMutation({
    mutationFn: (filename: string) => api.del(`/api/media/files/${filename}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["media-files"] })
      setDeleteTarget(null)
    },
  })

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setUploadError("")
    setUploading(true)
    try {
      const form = new FormData()
      form.append("file", file)
      const url = uploadFolder
        ? `/api/media/upload?folder=${encodeURIComponent(uploadFolder)}`
        : `/api/media/upload`
      await api.upload(url, form)
      qc.invalidateQueries({ queryKey: ["media-files"] })
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : "Upload failed")
    } finally {
      setUploading(false)
      if (fileRef.current) fileRef.current.value = ""
    }
  }

  async function copyUrl(url: string) {
    let ok = false
    // The async Clipboard API only works in a secure context (HTTPS or localhost).
    // Over plain HTTP (e.g. the VPS on an IP) it's unavailable, so fall back to the
    // legacy execCommand copy.
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(url)
        ok = true
      }
    } catch {
      ok = false
    }
    if (!ok) {
      const ta = document.createElement("textarea")
      ta.value = url
      ta.style.position = "fixed"
      ta.style.left = "-9999px"
      document.body.appendChild(ta)
      ta.select()
      try {
        ok = document.execCommand("copy")
      } catch {
        ok = false
      }
      document.body.removeChild(ta)
    }
    if (ok) {
      setCopied(url)
      setTimeout(() => setCopied(null), 2000)
    }
  }

  const filteredFiles = useMemo(() => {
    const term = search.trim().toLowerCase()
    if (!term) return files
    return files.filter(f => f.filename.toLowerCase().includes(term))
  }, [files, search])

  const groupedFiles = useMemo(() => {
    const map = new Map<string, MediaFile[]>()
    for (const f of filteredFiles) {
      const folder = getFolder(f.filename)
      if (!map.has(folder)) map.set(folder, [])
      map.get(folder)!.push(f)
    }
    // Sort: named folders alphabetically, root ("") last
    const entries = Array.from(map.entries()).sort(([a], [b]) => {
      if (a === "" && b !== "") return 1
      if (a !== "" && b === "") return -1
      return a.localeCompare(b)
    })
    return new Map(entries)
  }, [filteredFiles])

  return (
    <div>
      <PageHeader
        title="Media Library"
        description="Manage uploaded images"
        actionNode={
          <div className="flex items-center gap-2">
            <div className="relative">
              <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Search filename…"
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="border border-slate-300 rounded-lg pl-8 pr-3 py-1.5 text-sm w-44 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div className="flex items-center border border-slate-300 rounded-lg overflow-hidden">
              <button
                onClick={() => setView("grid")}
                title="Grid view"
                className={`p-1.5 ${view === "grid" ? "bg-blue-600 text-white" : "bg-white text-slate-500 hover:bg-slate-50"}`}
              >
                <LayoutGrid size={15} />
              </button>
              <button
                onClick={() => setView("list")}
                title="List view"
                className={`p-1.5 ${view === "list" ? "bg-blue-600 text-white" : "bg-white text-slate-500 hover:bg-slate-50"}`}
              >
                <List size={15} />
              </button>
            </div>
            <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleUpload} />
            <input
              type="text"
              placeholder="Folder (e.g. products)"
              value={uploadFolder}
              onChange={e => setUploadFolder(e.target.value.replace(/[^a-zA-Z0-9_-]/g, ""))}
              className="border border-slate-300 rounded-lg px-3 py-1.5 text-sm w-40 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <button
              onClick={() => fileRef.current?.click()}
              disabled={uploading}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg disabled:opacity-50 transition-colors"
            >
              <Upload size={15} />
              {uploading ? "Uploading…" : "Upload Image"}
            </button>
          </div>
        }
      />

      {uploadError && (
        <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2 mb-4">{uploadError}</p>
      )}

      {isLoading && (
        <div className="flex justify-center py-16"><div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" /></div>
      )}

      {!isLoading && files.length === 0 && (
        <div className="text-center py-16 text-slate-400">
          <p className="text-sm">No images uploaded yet.</p>
          <p className="text-xs mt-1">Upload your first image using the button above.</p>
        </div>
      )}

      {!isLoading && files.length > 0 && filteredFiles.length === 0 && (
        <div className="text-center py-16 text-slate-400">
          <p className="text-sm">No files match &quot;{search}&quot;.</p>
        </div>
      )}

      {!isLoading && filteredFiles.length > 0 && (
        <div>
          {Array.from(groupedFiles.entries()).map(([folder, groupFiles]) => (
            <div key={folder} className="mb-6">
              <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">
                {folder === "" ? "Root" : folder}
              </h3>
              {view === "list" ? (
                <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                  <table className="w-full">
                    <thead className="bg-slate-50 border-b border-slate-200">
                      <tr>
                        <th className="w-16 py-2 px-3" />
                        <th className="text-left py-2 px-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Filename</th>
                        <th className="text-left py-2 px-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">URL</th>
                        <th className="py-2 px-3" />
                      </tr>
                    </thead>
                    <tbody>
                      {groupFiles.map(f => (
                        <tr key={f.filename} className="border-t border-slate-100">
                          <td className="py-2 px-3">
                            <div className="w-10 h-10 rounded bg-slate-50 overflow-hidden">
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img
                                src={f.url}
                                alt={f.filename}
                                className="w-full h-full object-cover"
                                onError={(e) => { (e.target as HTMLImageElement).style.display = "none" }}
                              />
                            </div>
                          </td>
                          <td className="py-2 px-3 text-sm text-slate-700 truncate max-w-[200px]" title={f.filename}>{getBasename(f.filename)}</td>
                          <td className="py-2 px-3 text-xs text-slate-500 font-mono truncate max-w-[300px]" title={f.url}>{f.url}</td>
                          <td className="py-2 px-3">
                            <div className="flex gap-1.5 justify-end">
                              <button
                                onClick={() => copyUrl(f.url)}
                                title="Copy URL"
                                className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-600 transition-colors"
                              >
                                {copied === f.url ? <Check size={13} className="text-green-600" /> : <Copy size={13} />}
                              </button>
                              <button
                                onClick={() => setDeleteTarget(f.filename)}
                                title="Delete"
                                className="p-1.5 rounded-lg bg-slate-100 hover:bg-red-50 hover:text-red-600 text-slate-500 transition-colors"
                              >
                                <Trash2 size={13} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
                {groupFiles.map(f => (
                  <div key={f.filename} className="bg-white rounded-xl border border-slate-200 overflow-hidden group">
                    <div className="aspect-square bg-slate-50 relative">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={f.url}
                        alt={f.filename}
                        className="w-full h-full object-cover"
                        onError={(e) => { (e.target as HTMLImageElement).style.display = "none" }}
                      />
                    </div>
                    <div className="p-2.5">
                      <p className="text-xs text-slate-700 font-medium truncate" title={f.filename}>{getBasename(f.filename)}</p>
                      <p className="text-xs text-slate-400 mt-0.5">{formatBytes(f.size)}</p>
                      <div className="flex gap-1.5 mt-2">
                        <button
                          onClick={() => copyUrl(f.url)}
                          title="Copy URL"
                          className="flex-1 flex items-center justify-center gap-1 px-2 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-600 text-xs transition-colors"
                        >
                          {copied === f.url ? <Check size={12} className="text-green-600" /> : <Copy size={12} />}
                          {copied === f.url ? "Copied" : "Copy URL"}
                        </button>
                        <button
                          onClick={() => setDeleteTarget(f.filename)}
                          title="Delete"
                          className="p-1.5 rounded-lg bg-slate-100 hover:bg-red-50 hover:text-red-600 text-slate-500 transition-colors"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Delete confirmation */}
      {deleteTarget && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl p-6 max-w-sm w-full shadow-xl">
            <h3 className="font-semibold text-slate-900 mb-2">Delete image?</h3>
            <p className="text-sm text-slate-600 mb-1">
              <span className="font-mono text-xs bg-slate-100 px-1.5 py-0.5 rounded">{deleteTarget}</span>
            </p>
            <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 mt-3 mb-4">
              Any products or pages using this image URL will show a broken image.
            </p>
            <div className="flex gap-2 justify-end">
              <button onClick={() => setDeleteTarget(null)} className="px-4 py-2 text-sm text-slate-600 border border-slate-300 rounded-lg hover:bg-slate-50">
                Cancel
              </button>
              <button
                onClick={() => deleteMutation.mutate(deleteTarget)}
                disabled={deleteMutation.isPending}
                className="px-4 py-2 text-sm bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50"
              >
                {deleteMutation.isPending ? "Deleting…" : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

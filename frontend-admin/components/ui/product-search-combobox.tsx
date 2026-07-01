"use client"
import { useState, useEffect, useRef } from "react"
import { useQuery } from "@tanstack/react-query"
import { api } from "@/lib/api"
import type { Product } from "@/lib/types"

interface Props {
  value: string
  onChange: (id: string, name: string) => void
  placeholder?: string
  className?: string
}

export function ProductSearchCombobox({
  value,
  onChange,
  placeholder = "Search products…",
  className = "",
}: Props) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState("")
  const [selectedName, setSelectedName] = useState("")
  const [debouncedQuery, setDebouncedQuery] = useState("")
  const [focusedIndex, setFocusedIndex] = useState(-1)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const t = setTimeout(() => setDebouncedQuery(query), 300)
    return () => clearTimeout(t)
  }, [query])

  const { data } = useQuery({
    queryKey: ["product-search", debouncedQuery],
    queryFn: () =>
      api.get(`/api/products?search=${encodeURIComponent(debouncedQuery)}&page_size=20&sort_by=name`),
    staleTime: 30_000,
  })
  const results: Product[] = data?.items ?? []

  useEffect(() => {
    function onMouseDown(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
        setQuery("")
        setFocusedIndex(-1)
      }
    }
    document.addEventListener("mousedown", onMouseDown)
    return () => document.removeEventListener("mousedown", onMouseDown)
  }, [])

  useEffect(() => {
    if (!value) setSelectedName("")
  }, [value])

  function handleSelect(product: Product) {
    setSelectedName(product.name)
    setQuery("")
    setOpen(false)
    setFocusedIndex(-1)
    onChange(product.id, product.name)
  }

  function handleInputClick() {
    setOpen(true)
    setQuery("")
    setFocusedIndex(-1)
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (!open) {
      if (e.key === "ArrowDown" || e.key === "Enter") {
        setOpen(true)
        return
      }
    }
    if (e.key === "ArrowDown") {
      setFocusedIndex((i) => Math.min(i + 1, results.length - 1))
    } else if (e.key === "ArrowUp") {
      setFocusedIndex((i) => Math.max(i - 1, 0))
    } else if (e.key === "Enter" && focusedIndex >= 0) {
      handleSelect(results[focusedIndex])
    } else if (e.key === "Escape") {
      setOpen(false)
      setQuery("")
      setFocusedIndex(-1)
    }
  }

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      <input
        type="text"
        value={open ? query : selectedName}
        placeholder={open ? "Type to search…" : placeholder}
        onChange={(e) => { setQuery(e.target.value); setFocusedIndex(-1) }}
        onClick={handleInputClick}
        onKeyDown={handleKeyDown}
        className="w-full border border-slate-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
        autoComplete="off"
      />
      {open && (
        <ul className="absolute z-50 mt-1 w-full bg-white border border-slate-200 rounded-lg shadow-lg max-h-60 overflow-auto">
          {results.length === 0 ? (
            <li className="px-3 py-2 text-sm text-slate-400">No products found</li>
          ) : (
            results.map((p, i) => (
              <li
                key={p.id}
                onMouseDown={() => handleSelect(p)}
                className={`px-3 py-2 text-sm cursor-pointer ${
                  i === focusedIndex
                    ? "bg-blue-50 text-blue-700"
                    : "text-slate-700 hover:bg-slate-50"
                }`}
              >
                {p.name}
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  )
}

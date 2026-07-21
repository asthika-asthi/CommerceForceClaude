"use client"

import { useMemo, useState, useTransition } from "react"
import { LandingSectionRenderer } from "@/components/shop/landing-section"
import type { LandingConfigSection } from "@/lib/landing-config"
import type { BlockSchema, FieldDescriptor } from "@/lib/dev/block-schema-extractor"
import { resolveInputWidget } from "@/lib/dev/field-type-inference"
import { saveBuilderConfig, type SaveError } from "./actions"

interface SectionInstance {
  localId: string
  __block: string
  [key: string]: unknown
}

let idCounter = 0
function nextLocalId(): string {
  idCounter += 1
  return `s${idCounter}`
}

function defaultValueForField(field: FieldDescriptor): unknown {
  switch (field.kind) {
    case "string":
      return ""
    case "number":
      return 0
    case "boolean":
      return false
    case "enum":
      return field.enumOptions?.[0] ?? ""
    case "array-string":
      return []
    case "array-object":
      return []
    case "unknown":
      return field.optional ? undefined : ""
  }
}

function defaultItemForFields(fields: FieldDescriptor[]): Record<string, unknown> {
  const item: Record<string, unknown> = {}
  for (const f of fields) item[f.name] = defaultValueForField(f)
  return item
}

function defaultInstanceForBlock(key: string, schema: BlockSchema): SectionInstance {
  const instance: SectionInstance = { localId: nextLocalId(), __block: key }
  for (const field of schema.fields) instance[field.name] = defaultValueForField(field)
  return instance
}

const CATEGORY_LABELS: Record<string, string> = {
  visual: "Visual",
  commerce: "Commerce",
  content: "Content",
  layout: "Layout",
  landing: "Tri Star Originals",
  other: "Other",
}

function toConfigSections(sections: SectionInstance[]): LandingConfigSection[] {
  return sections.map(({ localId: _localId, ...rest }) => rest as unknown as LandingConfigSection)
}

export function BuilderClient({
  schemas,
  initialSections,
  initialPlugins,
}: {
  schemas: Record<string, BlockSchema>
  initialSections: LandingConfigSection[]
  initialPlugins: string[]
}) {
  const [sections, setSections] = useState<SectionInstance[]>(() =>
    initialSections.map((s) => ({ localId: nextLocalId(), ...s }) as SectionInstance)
  )
  const [saveErrors, setSaveErrors] = useState<SaveError[] | null>(null)
  const [saveSuccess, setSaveSuccess] = useState(false)
  const [isPending, startTransition] = useTransition()
  const [draggedId, setDraggedId] = useState<string | null>(null)

  const groupedBlocks = useMemo(() => {
    const groups: Record<string, string[]> = {}
    for (const key of Object.keys(schemas).sort()) {
      const cat = schemas[key].category
      groups[cat] = groups[cat] ?? []
      groups[cat].push(key)
    }
    return groups
  }, [schemas])

  const currentlyRequiredPlugins = useMemo(() => {
    const set = new Set<string>()
    for (const s of sections) {
      const req = schemas[s.__block]?.requiredPlugin
      if (req) set.add(req)
    }
    return set
  }, [sections, schemas])

  const activePlugins = useMemo(() => {
    const set = new Set(initialPlugins)
    for (const p of currentlyRequiredPlugins) set.add(p)
    return [...set]
  }, [initialPlugins, currentlyRequiredPlugins])

  const unneededPlugins = activePlugins.filter((p) => !currentlyRequiredPlugins.has(p))

  function addBlock(key: string) {
    const schema = schemas[key]
    if (!schema) return
    setSaveSuccess(false)
    setSections((prev) => [...prev, defaultInstanceForBlock(key, schema)])
  }

  function removeBlock(localId: string) {
    setSaveSuccess(false)
    setSections((prev) => prev.filter((s) => s.localId !== localId))
  }

  function moveBlock(localId: string, direction: -1 | 1) {
    setSaveSuccess(false)
    setSections((prev) => {
      const index = prev.findIndex((s) => s.localId === localId)
      const target = index + direction
      if (index === -1 || target < 0 || target >= prev.length) return prev
      const next = [...prev]
      ;[next[index], next[target]] = [next[target], next[index]]
      return next
    })
  }

  /** Drops the dragged section into the position the drop target currently occupies. */
  function reorderByDrag(draggedLocalId: string, targetLocalId: string) {
    if (draggedLocalId === targetLocalId) return
    setSaveSuccess(false)
    setSections((prev) => {
      const dragged = prev.find((s) => s.localId === draggedLocalId)
      if (!dragged) return prev
      const without = prev.filter((s) => s.localId !== draggedLocalId)
      const targetIndex = without.findIndex((s) => s.localId === targetLocalId)
      if (targetIndex === -1) return prev
      const next = [...without]
      next.splice(targetIndex, 0, dragged)
      return next
    })
  }

  function updateFieldValue(localId: string, fieldName: string, value: unknown) {
    setSaveSuccess(false)
    setSections((prev) =>
      prev.map((s) => (s.localId === localId ? { ...s, [fieldName]: value } : s))
    )
  }

  /** Fallback for a block whose fields couldn't be read at all — replaces every
   *  prop on the section (except the block key and local id) with a raw JSON edit. */
  function replaceSectionProps(localId: string, newProps: Record<string, unknown>) {
    setSaveSuccess(false)
    setSections((prev) =>
      prev.map((s) => (s.localId === localId ? { localId: s.localId, __block: s.__block, ...newProps } : s))
    )
  }

  function errorsFor(localId: string): SaveError[] {
    if (!saveErrors) return []
    const index = sections.findIndex((s) => s.localId === localId)
    return saveErrors.filter((e) => e.sectionIndex === index)
  }

  function handleSave() {
    setSaveErrors(null)
    setSaveSuccess(false)
    startTransition(async () => {
      const result = await saveBuilderConfig(toConfigSections(sections))
      if (result.success) {
        setSaveSuccess(true)
      } else {
        setSaveErrors(result.errors)
      }
    })
  }

  return (
    <div style={{ display: "flex", height: "100vh", fontFamily: "system-ui, sans-serif", fontSize: 14 }}>
      {/* Block browser */}
      <div style={{ width: 260, borderRight: "1px solid #ddd", overflowY: "auto", padding: 12, flexShrink: 0 }}>
        <h2 style={{ fontSize: 15, fontWeight: 700, marginBottom: 12 }}>Add a block</h2>
        {Object.entries(groupedBlocks).map(([category, keys]) => (
          <div key={category} style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", color: "#888", marginBottom: 6 }}>
              {CATEGORY_LABELS[category] ?? category}
            </div>
            {keys.map((key) => (
              <button
                key={key}
                onClick={() => addBlock(key)}
                title={
                  schemas[key].error
                    ? `Couldn't read this block's fields: ${schemas[key].error} — still addable, edited as raw JSON.`
                    : schemas[key].isAsync
                      ? "Fetches live data — won't render in the preview below"
                      : undefined
                }
                style={{
                  display: "block",
                  width: "100%",
                  textAlign: "left",
                  padding: "6px 8px",
                  marginBottom: 3,
                  fontSize: 12.5,
                  border: schemas[key].error ? "1px solid #e0b3b3" : "1px solid #e0e0e0",
                  borderRadius: 6,
                  background: schemas[key].error ? "#fff5f5" : "#fff",
                  cursor: "pointer",
                }}
              >
                {key}
                {schemas[key].error && <span style={{ color: "#c8102e", marginLeft: 4 }}>⚠</span>}
                {!schemas[key].error && schemas[key].isAsync && <span style={{ color: "#c8102e", marginLeft: 4 }}>●</span>}
              </button>
            ))}
          </div>
        ))}
      </div>

      {/* Form column */}
      <div style={{ width: 420, borderRight: "1px solid #ddd", overflowY: "auto", padding: 16, flexShrink: 0 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
          <h2 style={{ fontSize: 15, fontWeight: 700 }}>Page ({sections.length} sections)</h2>
          <button
            onClick={handleSave}
            disabled={isPending}
            style={{
              background: "#18c98e",
              color: "#111",
              border: "none",
              borderRadius: 6,
              padding: "8px 16px",
              fontWeight: 700,
              cursor: isPending ? "default" : "pointer",
              opacity: isPending ? 0.6 : 1,
            }}
          >
            {isPending ? "Saving…" : "Save"}
          </button>
        </div>

        {saveSuccess && (
          <div style={{ background: "#e6f9f1", color: "#0a6b4a", padding: 10, borderRadius: 6, marginBottom: 12 }}>
            Saved to landing-page.config.json.
          </div>
        )}

        {unneededPlugins.length > 0 && (
          <div style={{ background: "#fff8e1", color: "#7a5c00", padding: 10, borderRadius: 6, marginBottom: 12, fontSize: 12.5 }}>
            Enabled but not required by anything on this page: {unneededPlugins.join(", ")} — left on, remove by hand if you want it fully off.
          </div>
        )}

        {sections.length === 0 && (
          <p style={{ color: "#888" }}>No sections yet — add one from the list on the left.</p>
        )}

        {sections.map((section, i) => {
          const schema = schemas[section.__block]
          const errors = errorsFor(section.localId)
          return (
            <div
              key={section.localId}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault()
                if (draggedId) reorderByDrag(draggedId, section.localId)
                setDraggedId(null)
              }}
              style={{
                border: errors.length > 0 ? "1.5px solid #c8102e" : "1px solid #e0e0e0",
                borderRadius: 8,
                padding: 12,
                marginBottom: 12,
                opacity: draggedId === section.localId ? 0.4 : 1,
              }}
            >
              <div
                draggable
                onDragStart={() => setDraggedId(section.localId)}
                onDragEnd={() => setDraggedId(null)}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  marginBottom: 8,
                  cursor: "grab",
                }}
              >
                <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <span style={{ color: "#bbb", fontSize: 13 }} aria-hidden>⠿</span>
                  <strong style={{ fontSize: 13 }}>{section.__block}</strong>
                </span>
                <div style={{ display: "flex", gap: 4 }}>
                  <button onClick={() => moveBlock(section.localId, -1)} disabled={i === 0} style={smallBtnStyle}>↑</button>
                  <button onClick={() => moveBlock(section.localId, 1)} disabled={i === sections.length - 1} style={smallBtnStyle}>↓</button>
                  <button onClick={() => removeBlock(section.localId)} style={{ ...smallBtnStyle, color: "#c8102e" }}>✕</button>
                </div>
              </div>

              {schema?.isAsync && (
                <p style={{ fontSize: 11.5, color: "#7a5c00", marginBottom: 8 }}>
                  Fetches its own live data — won&apos;t appear in the preview pane, but will render correctly on the real site.
                </p>
              )}

              {errors.map((e, ei) => (
                <p key={ei} style={{ fontSize: 11.5, color: "#c8102e", marginBottom: 4 }}>{e.message}</p>
              ))}

              {schema?.error ? (
                <div>
                  <p style={{ fontSize: 11.5, color: "#c8102e", marginBottom: 6 }}>
                    Couldn&apos;t read this block&apos;s fields ({schema.error}) — every other block is unaffected. Edit its content as raw JSON below instead.
                  </p>
                  <WholeSectionJsonEditor
                    section={section}
                    onChange={(props) => replaceSectionProps(section.localId, props)}
                  />
                </div>
              ) : (
                <>
                  {schema?.fields.length === 0 && (
                    <p style={{ fontSize: 12, color: "#888" }}>No editable fields on this block.</p>
                  )}
                  {schema?.fields.map((field) => (
                    <FieldEditor
                      key={field.name}
                      field={field}
                      value={section[field.name]}
                      onChange={(v) => updateFieldValue(section.localId, field.name, v)}
                    />
                  ))}
                </>
              )}
            </div>
          )
        })}
      </div>

      {/* Live preview */}
      <div style={{ flex: 1, overflowY: "auto", background: "#f5f5f3" }}>
        <div style={{ padding: "8px 16px", fontSize: 11, color: "#888", background: "#fff", borderBottom: "1px solid #eee" }}>
          Live preview — real components, real theme. Blocks marked ● above fetch their own data and don&apos;t render here.
        </div>
        {toConfigSections(sections.filter((s) => !schemas[s.__block]?.isAsync)).map((section, i) => (
          <LandingSectionRenderer key={i} section={section} data={undefined} />
        ))}
      </div>
    </div>
  )
}

const smallBtnStyle: React.CSSProperties = {
  border: "1px solid #ddd",
  background: "#fff",
  borderRadius: 4,
  width: 24,
  height: 24,
  fontSize: 12,
  cursor: "pointer",
}

function FieldEditor({
  field,
  value,
  onChange,
}: {
  field: FieldDescriptor
  value: unknown
  onChange: (v: unknown) => void
}) {
  const widget = resolveInputWidget(field)

  return (
    <div style={{ marginBottom: 10 }}>
      <label style={{ display: "block", fontSize: 11.5, fontWeight: 600, marginBottom: 3, color: "#444" }}>
        {field.label}
        {!field.optional && <span style={{ color: "#c8102e" }}> *</span>}
      </label>

      {(widget === "text" || widget === "link") && (
        <input
          type="text"
          value={typeof value === "string" ? value : ""}
          onChange={(e) => onChange(e.target.value)}
          style={inputStyle}
        />
      )}

      {widget === "image" && (
        <div>
          <input
            type="text"
            value={typeof value === "string" ? value : ""}
            onChange={(e) => onChange(e.target.value)}
            placeholder="/images/example.jpg"
            style={inputStyle}
          />
          {typeof value === "string" && value && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={value}
              alt=""
              style={{ marginTop: 4, height: 48, borderRadius: 4, border: "1px solid #eee" }}
              onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none" }}
            />
          )}
        </div>
      )}

      {widget === "number" && (
        <input
          type="number"
          value={typeof value === "number" ? value : 0}
          onChange={(e) => onChange(Number(e.target.value))}
          style={inputStyle}
        />
      )}

      {widget === "boolean" && (
        <input
          type="checkbox"
          checked={Boolean(value)}
          onChange={(e) => onChange(e.target.checked)}
        />
      )}

      {widget === "select" && (
        <select
          value={typeof value === "string" ? value : field.enumOptions?.[0] ?? ""}
          onChange={(e) => onChange(e.target.value)}
          style={inputStyle}
        >
          {(field.enumOptions ?? []).map((opt) => (
            <option key={opt} value={opt}>{opt}</option>
          ))}
        </select>
      )}

      {widget === "list-string" && (
        <ListStringEditor value={Array.isArray(value) ? (value as string[]) : []} onChange={onChange} />
      )}

      {widget === "list-object" && (
        <ListObjectEditor
          value={Array.isArray(value) ? (value as Record<string, unknown>[]) : []}
          itemFields={field.itemFields ?? []}
          onChange={onChange}
        />
      )}

      {widget === "unknown" && (
        <UnknownFieldEditor value={value} onChange={onChange} />
      )}
    </div>
  )
}

function ListStringEditor({ value, onChange }: { value: string[]; onChange: (v: string[]) => void }) {
  return (
    <div>
      {value.map((item, i) => (
        <div key={i} style={{ display: "flex", gap: 4, marginBottom: 4 }}>
          <input
            type="text"
            value={item}
            onChange={(e) => {
              const next = [...value]
              next[i] = e.target.value
              onChange(next)
            }}
            style={inputStyle}
          />
          <button onClick={() => onChange(value.filter((_, vi) => vi !== i))} style={smallBtnStyle}>✕</button>
        </div>
      ))}
      <button onClick={() => onChange([...value, ""])} style={addBtnStyle}>+ Add item</button>
    </div>
  )
}

function ListObjectEditor({
  value,
  itemFields,
  onChange,
}: {
  value: Record<string, unknown>[]
  itemFields: FieldDescriptor[]
  onChange: (v: Record<string, unknown>[]) => void
}) {
  return (
    <div>
      {value.map((item, i) => (
        <div key={i} style={{ border: "1px solid #eee", borderRadius: 6, padding: 8, marginBottom: 6 }}>
          <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 4 }}>
            <button onClick={() => onChange(value.filter((_, vi) => vi !== i))} style={smallBtnStyle}>✕</button>
          </div>
          {itemFields.map((sub) => (
            <FieldEditor
              key={sub.name}
              field={sub}
              value={item[sub.name]}
              onChange={(v) => {
                const next = [...value]
                next[i] = { ...next[i], [sub.name]: v }
                onChange(next)
              }}
            />
          ))}
        </div>
      ))}
      <button onClick={() => onChange([...value, defaultItemForFields(itemFields)])} style={addBtnStyle}>
        + Add item
      </button>
    </div>
  )
}

/** Fallback for a block whose fields couldn't be extracted at all — edits every
 *  prop on the section (aside from __block/localId) as one raw JSON object. */
function WholeSectionJsonEditor({
  section,
  onChange,
}: {
  section: SectionInstance
  onChange: (props: Record<string, unknown>) => void
}) {
  const { localId: _localId, __block: _block, ...props } = section
  const [text, setText] = useState(() => JSON.stringify(props, null, 2))
  const [error, setError] = useState<string | null>(null)

  return (
    <div>
      <textarea
        value={text}
        onChange={(e) => {
          setText(e.target.value)
          try {
            const parsed = JSON.parse(e.target.value)
            if (typeof parsed === "object" && parsed !== null && !Array.isArray(parsed)) {
              onChange(parsed)
              setError(null)
            } else {
              setError("Must be a JSON object")
            }
          } catch {
            setError("Not valid JSON yet")
          }
        }}
        rows={10}
        style={{ ...inputStyle, fontFamily: "monospace", fontSize: 11.5 }}
      />
      {error && <p style={{ fontSize: 11, color: "#c8102e" }}>{error}</p>}
    </div>
  )
}

function UnknownFieldEditor({ value, onChange }: { value: unknown; onChange: (v: unknown) => void }) {
  const [text, setText] = useState(() => JSON.stringify(value ?? null, null, 2))
  const [error, setError] = useState<string | null>(null)

  return (
    <div>
      <textarea
        value={text}
        onChange={(e) => {
          setText(e.target.value)
          try {
            onChange(JSON.parse(e.target.value))
            setError(null)
          } catch {
            setError("Not valid JSON yet")
          }
        }}
        rows={3}
        style={{ ...inputStyle, fontFamily: "monospace", fontSize: 11.5 }}
      />
      {error && <p style={{ fontSize: 11, color: "#c8102e" }}>{error}</p>}
    </div>
  )
}

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "6px 8px",
  border: "1px solid #ccc",
  borderRadius: 5,
  fontSize: 12.5,
  boxSizing: "border-box",
}

const addBtnStyle: React.CSSProperties = {
  border: "1px dashed #ccc",
  background: "none",
  borderRadius: 5,
  padding: "5px 10px",
  fontSize: 11.5,
  cursor: "pointer",
  color: "#666",
}

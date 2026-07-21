"use server"

import fs from "fs/promises"
import path from "path"
import { extractAllBlockSchemas, type BlockSchema, type FieldDescriptor } from "@/lib/dev/block-schema-extractor"
import type { LandingConfigSection } from "@/lib/landing-config"

export interface SaveError {
  sectionIndex: number
  blockKey: string
  message: string
}

export type SaveResult = { success: true } | { success: false; errors: SaveError[] }

function validateValue(value: unknown, field: FieldDescriptor): string | null {
  const isEmpty =
    value === undefined ||
    value === null ||
    value === "" ||
    (Array.isArray(value) && value.length === 0)

  if (isEmpty) {
    return field.optional ? null : `"${field.label}" is required`
  }

  switch (field.kind) {
    case "string":
      return typeof value === "string" ? null : `"${field.label}" must be text`
    case "number":
      return typeof value === "number" && !Number.isNaN(value) ? null : `"${field.label}" must be a number`
    case "boolean":
      return typeof value === "boolean" ? null : `"${field.label}" must be true or false`
    case "enum":
      return typeof value === "string" && field.enumOptions?.includes(value)
        ? null
        : `"${field.label}" must be one of: ${(field.enumOptions ?? []).join(", ")}`
    case "array-string":
      return Array.isArray(value) && value.every((v) => typeof v === "string")
        ? null
        : `"${field.label}" must be a list of text values`
    case "array-object": {
      if (!Array.isArray(value)) return `"${field.label}" must be a list`
      for (let i = 0; i < value.length; i++) {
        const item = value[i]
        if (typeof item !== "object" || item === null) {
          return `"${field.label}" item ${i + 1} is invalid`
        }
        for (const subField of field.itemFields ?? []) {
          const err = validateValue((item as Record<string, unknown>)[subField.name], subField)
          if (err) return `"${field.label}" item ${i + 1}: ${err}`
        }
      }
      return null
    }
    case "unknown":
      return null
  }
}

function validateSection(
  section: LandingConfigSection,
  index: number,
  schemas: Record<string, BlockSchema>
): SaveError[] {
  const schema = schemas[section.__block]
  if (!schema) {
    return [{ sectionIndex: index, blockKey: section.__block, message: `"${section.__block}" is not a known block` }]
  }
  const errors: SaveError[] = []
  for (const field of schema.fields) {
    const err = validateValue(section[field.name], field)
    if (err) errors.push({ sectionIndex: index, blockKey: section.__block, message: err })
  }
  return errors
}

function validateAllSections(
  sections: LandingConfigSection[],
  schemas: Record<string, BlockSchema>
): SaveError[] {
  return sections.flatMap((section, i) => validateSection(section, i, schemas))
}

/** Adds any plugin a currently-present block requires. Never removes an existing entry — a plugin
 *  no longer required by any section on the page might still be wanted for other reasons, and
 *  silently disabling it would be a bigger, riskier decision than this tool should make unasked. */
function mergePlugins(
  existingPlugins: string[],
  sections: LandingConfigSection[],
  schemas: Record<string, BlockSchema>
): string[] {
  const merged = [...existingPlugins]
  for (const section of sections) {
    const required = schemas[section.__block]?.requiredPlugin
    if (required && !merged.includes(required)) merged.push(required)
  }
  return merged
}

export async function loadBuilderData(): Promise<{
  schemas: Record<string, BlockSchema>
  sections: LandingConfigSection[]
  plugins: string[]
}> {
  const schemas = extractAllBlockSchemas()
  const configPath = path.join(process.cwd(), "landing-page.config.json")
  const raw = await fs.readFile(configPath, "utf-8")
  const config = JSON.parse(raw) as { sections?: LandingConfigSection[]; plugins?: string[] }
  return { schemas, sections: config.sections ?? [], plugins: config.plugins ?? [] }
}

export async function saveBuilderConfig(sections: LandingConfigSection[]): Promise<SaveResult> {
  if (process.env.NODE_ENV === "production") {
    return { success: false, errors: [{ sectionIndex: -1, blockKey: "", message: "Not available in production" }] }
  }

  const schemas = extractAllBlockSchemas()
  const errors = validateAllSections(sections, schemas)
  if (errors.length > 0) return { success: false, errors }

  const configPath = path.join(process.cwd(), "landing-page.config.json")
  const raw = await fs.readFile(configPath, "utf-8")
  const fullConfig = JSON.parse(raw) as Record<string, unknown>

  const plugins = mergePlugins((fullConfig.plugins as string[] | undefined) ?? [], sections, schemas)
  const updated = { ...fullConfig, sections, plugins }

  const tmpPath = `${configPath}.tmp-${Date.now()}`
  await fs.writeFile(tmpPath, JSON.stringify(updated, null, 2) + "\n", "utf-8")
  await fs.rename(tmpPath, configPath)

  return { success: true }
}

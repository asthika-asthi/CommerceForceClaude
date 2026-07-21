import type { FieldDescriptor } from "./block-schema-extractor"

/**
 * Decides which form input to render for a field. Reuses the exact same
 * name-based convention already shipped for the Page Content Editor
 * (backend/app/plugins/landing_page/service.py: infer_field_type) so the two
 * tools agree on what "an image field" or "a link field" looks like, then
 * layers the real TypeScript type (read by block-schema-extractor.ts) on top
 * for everything the name alone can't tell you — a checkbox for a boolean, a
 * dropdown for a small fixed set of choices, a repeatable list for an array.
 */

export type InputWidget =
  | "text"
  | "image"
  | "link"
  | "number"
  | "boolean"
  | "select"
  | "list-string"
  | "list-object"
  | "unknown"

const IMAGE_NAME_TOKENS = ["image", "logo", "photo", "avatar", "icon"]

function inferStringFieldWidget(fieldName: string): "image" | "link" | "text" {
  const lname = fieldName.toLowerCase()
  if (IMAGE_NAME_TOKENS.some((t) => lname.includes(t)) || lname.endsWith("src")) return "image"
  if (lname.endsWith("url") || lname.endsWith("href")) return "link"
  return "text"
}

export function resolveInputWidget(field: FieldDescriptor): InputWidget {
  switch (field.kind) {
    case "boolean":
      return "boolean"
    case "number":
      return "number"
    case "enum":
      return "select"
    case "array-string":
      return "list-string"
    case "array-object":
      return "list-object"
    case "string":
      return inferStringFieldWidget(field.name)
    default:
      return "unknown"
  }
}

// Mirrors FONT_SIZE_OPTIONS / HEADER_SIZE_OPTIONS in
// frontend-starter/lib/header-config.ts — the storefront copy is the source of
// truth (same discipline as font-options.ts / theme-colors.ts). Keep the value
// strings identical; the backend (branding/schemas.py) validates against the
// same sets.

export const FONT_SIZE_OPTIONS = [
  { value: "compact", label: "Compact (15px)" },
  { value: "default", label: "Default (16px)" },
  { value: "comfortable", label: "Comfortable (17px)" },
  { value: "large", label: "Large (18px)" },
  { value: "xlarge", label: "Extra large (20px)" },
] as const

export const HEADER_SIZE_OPTIONS = [
  { value: "compact", label: "Compact" },
  { value: "standard", label: "Standard (default)" },
  { value: "large", label: "Large" },
  { value: "xlarge", label: "Extra large" },
] as const

export const DEFAULT_FONT_SIZE = "default"
export const DEFAULT_HEADER_SIZE = "standard"

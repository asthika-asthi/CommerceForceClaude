// Storefront text-scale and header-size presets.
//
// These drive CSS custom properties injected as an inline style on <html> in
// app/layout.tsx (same path the theme colours take, so they beat :root defaults).
// The option arrays are mirrored in frontend-admin/lib/branding-options.ts — this
// copy is the source of truth (same discipline as lib/theme-colors.ts / lib/fonts.ts).
// The allowed value sets are also mirrored in backend branding/schemas.py.

export type BaseFontSize = "compact" | "default" | "comfortable" | "large" | "xlarge"
export type HeaderSize = "compact" | "standard" | "large" | "xlarge"

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

const FONT_SIZE_PX: Record<BaseFontSize, string> = {
  compact: "15px",
  default: "16px",
  comfortable: "17px",
  large: "18px",
  xlarge: "20px",
}

export function fontSizeValue(v?: string | null): string {
  const key = (v ?? "default") as BaseFontSize
  return FONT_SIZE_PX[key] ?? FONT_SIZE_PX.default
}

interface HeaderMetrics {
  height: string
  logo: string
  brand: string
  padX: string
  icon: string
  monogram: string
}

const HEADER_METRICS: Record<HeaderSize, HeaderMetrics> = {
  compact: { height: "56px", logo: "30px", brand: "16px", padX: "1.5rem", icon: "20px", monogram: "2.25rem" },
  standard: { height: "72px", logo: "40px", brand: "18px", padX: "2.5rem", icon: "22px", monogram: "2.75rem" },
  large: { height: "88px", logo: "52px", brand: "22px", padX: "3rem", icon: "26px", monogram: "3.25rem" },
  xlarge: { height: "104px", logo: "64px", brand: "26px", padX: "3.5rem", icon: "30px", monogram: "3.75rem" },
}

// One step down, applied while shrink-on-scroll is active. "compact" drops to a
// tighter set still.
const XCOMPACT: HeaderMetrics = { height: "48px", logo: "26px", brand: "15px", padX: "1.5rem", icon: "18px", monogram: "2rem" }
const SHRINK_STEP: Record<HeaderSize, HeaderSize | null> = {
  xlarge: "large",
  large: "standard",
  standard: "compact",
  compact: null,
}

export function resolveHeaderSize(v?: string | null): HeaderSize {
  const s = (v ?? "standard") as HeaderSize
  return s in HEADER_METRICS ? s : "standard"
}

function metricsFor(size: HeaderSize, shrunk: boolean): HeaderMetrics {
  if (!shrunk) return HEADER_METRICS[size]
  const step = SHRINK_STEP[size]
  return step === null ? XCOMPACT : HEADER_METRICS[step]
}

/** CSS custom properties for the given header size. Pass { shrunk: true } to get
 *  the condensed (scrolled) metrics for the shrink-on-scroll option. */
export function headerSizeVars(v?: string | null, opts?: { shrunk?: boolean }): Record<string, string> {
  const m = metricsFor(resolveHeaderSize(v), opts?.shrunk ?? false)
  return {
    "--header-height": m.height,
    "--header-logo-h": m.logo,
    "--header-brand-size": m.brand,
    "--header-pad-x": m.padX,
    "--header-icon-size": m.icon,
    "--header-monogram": m.monogram,
  }
}

/**
 * Theme colour derivation — shared logic between storefront and admin panel.
 *
 * IMPORTANT: this is a copy of frontend-starter/lib/theme-colors.ts (the two
 * apps share no package). The storefront copy is the source of truth — edit
 * it there and re-copy here — same discipline as docs/type-sync.md.
 *
 * The admin picks a handful of CORE colours; every dependent shade (hover,
 * tint, on-dark text tiers, …) is derived automatically unless individually
 * overridden. Families whose core colour is NOT set are left entirely
 * untouched so the theme-file defaults (themes/default/globals.css) apply.
 */

export type CoreKey = "brand" | "dark" | "accent" | "background" | "text"

export interface ThemeColors {
  core?: Partial<Record<CoreKey, string>>
  overrides?: Record<string, string>
}

export const CORE_COLOR_META: Array<{ key: CoreKey; label: string; hint: string }> = [
  { key: "brand", label: "Main brand colour", hint: "Buttons, links, badges and their hover/tint shades" },
  { key: "dark", label: "Dark / emphasis colour", hint: "Headings, dark section backgrounds and text on them" },
  { key: "accent", label: "Accent colour", hint: "Highlights like Special Offers and review stars" },
  { key: "background", label: "Page background", hint: "Overall page and subtle panel backgrounds" },
  { key: "text", label: "Text colour", hint: "Body text plus muted and placeholder tiers" },
]

const HEX_RE = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/

export function isValidHex(value: string): boolean {
  return HEX_RE.test(value.trim())
}

function hexToRgb(hex: string): [number, number, number] {
  let h = hex.trim().slice(1)
  if (h.length === 3) h = h.split("").map((c) => c + c).join("")
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)]
}

function rgbToHex(r: number, g: number, b: number): string {
  const c = (n: number) => Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, "0")
  return `#${c(r)}${c(g)}${c(b)}`
}

/** Mix `hex` toward `target` by `weight` (0..1). weight 0 = hex, 1 = target. */
function mix(hex: string, target: [number, number, number], weight: number): string {
  const [r, g, b] = hexToRgb(hex)
  return rgbToHex(r + (target[0] - r) * weight, g + (target[1] - g) * weight, b + (target[2] - b) * weight)
}

const WHITE: [number, number, number] = [255, 255, 255]
const BLACK: [number, number, number] = [0, 0, 0]

export function darken(hex: string, amount: number): string {
  return mix(hex, BLACK, amount)
}

export function lighten(hex: string, amount: number): string {
  return mix(hex, WHITE, amount)
}

function alpha(hex: string, a: number): string {
  const [r, g, b] = hexToRgb(hex)
  return `rgba(${r}, ${g}, ${b}, ${a})`
}

/** WCAG relative luminance (0..1). */
function luminance(hex: string): number {
  const [r, g, b] = hexToRgb(hex).map((v) => {
    const s = v / 255
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4)
  })
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

/** WCAG contrast ratio between two colours (1..21). */
export function contrastRatio(hexA: string, hexB: string): number {
  const la = luminance(hexA)
  const lb = luminance(hexB)
  const [hi, lo] = la > lb ? [la, lb] : [lb, la]
  return (hi + 0.05) / (lo + 0.05)
}

/** Readable text colour (white or near-black) for a given background. */
export function onColor(bgHex: string): string {
  return contrastRatio(bgHex, "#FFFFFF") >= contrastRatio(bgHex, "#1a1a1a") ? "#FFFFFF" : "#1a1a1a"
}

interface DerivedRule {
  token: string
  label: string
  derive: (core: string) => string
}

/** Base token + derived shades per family. Token names match the CSS
 *  variables in themes/default/globals.css (without the leading --). */
export const FAMILY_RULES: Record<CoreKey, { baseToken: string; baseLabel: string; derived: DerivedRule[] }> = {
  brand: {
    baseToken: "brand",
    baseLabel: "Main brand colour",
    derived: [
      { token: "brand-hover", label: "Button hover", derive: (c) => darken(c, 0.12) },
      { token: "brand-tint", label: "Light tint (hover backgrounds, pills)", derive: (c) => lighten(c, 0.92) },
      { token: "brand-highlight", label: "Highlight on dark backgrounds", derive: (c) => lighten(c, 0.65) },
      { token: "brand-shadow", label: "Card hover shadow", derive: (c) => alpha(c, 0.1) },
      { token: "on-brand", label: "Text on brand buttons", derive: (c) => onColor(c) },
    ],
  },
  dark: {
    baseToken: "brand-dark",
    baseLabel: "Dark / emphasis colour",
    derived: [
      { token: "dark-deep", label: "Deepest bands (footer)", derive: (c) => darken(c, 0.35) },
      { token: "dark-border", label: "Borders on dark surfaces", derive: (c) => lighten(c, 0.12) },
      { token: "on-dark-strong", label: "Brightest text on dark", derive: (c) => lighten(c, 0.75) },
      { token: "on-dark", label: "Body text on dark", derive: (c) => lighten(c, 0.6) },
      { token: "on-dark-muted", label: "Muted text on dark", derive: (c) => lighten(c, 0.42) },
      { token: "on-dark-faint", label: "Faintest text on dark", derive: (c) => lighten(c, 0.25) },
    ],
  },
  accent: {
    baseToken: "accent",
    baseLabel: "Accent colour",
    derived: [{ token: "accent-hover", label: "Accent hover", derive: (c) => lighten(c, 0.15) }],
  },
  background: {
    baseToken: "bg",
    baseLabel: "Page background",
    derived: [{ token: "surface-alt", label: "Subtle panels / zebra rows", derive: (c) => lighten(c, 0.5) }],
  },
  text: {
    baseToken: "fg",
    baseLabel: "Text colour",
    derived: [
      { token: "muted", label: "Secondary text", derive: (c) => lighten(c, 0.3) },
      { token: "text-placeholder", label: "Placeholder text", derive: (c) => lighten(c, 0.55) },
    ],
  },
}

/** All override-able tokens with labels, for the Advanced panel. */
export const ALL_DERIVED_TOKENS: Array<{ family: CoreKey } & DerivedRule> = (
  Object.keys(FAMILY_RULES) as CoreKey[]
).flatMap((family) => FAMILY_RULES[family].derived.map((rule) => ({ family, ...rule })))

/**
 * Compute the CSS-variable map for a saved theme_colors value.
 * Returns entries like { "--brand": "#D4A017", ... } containing ONLY the
 * variables that should override the theme-file defaults. Invalid values
 * are skipped (they end up in an inline style attribute, so only clean
 * hex/rgba strings we produced ourselves are allowed through).
 */
export function deriveTheme(themeColors: ThemeColors | null | undefined): Record<string, string> {
  const result: Record<string, string> = {}
  const core = themeColors?.core ?? {}
  const overrides = themeColors?.overrides ?? {}

  for (const family of Object.keys(FAMILY_RULES) as CoreKey[]) {
    const coreValue = core[family]
    if (!coreValue || !isValidHex(coreValue)) continue
    const rules = FAMILY_RULES[family]
    result[`--${rules.baseToken}`] = coreValue.trim()
    for (const rule of rules.derived) {
      result[`--${rule.token}`] = rule.derive(coreValue.trim())
    }
  }

  const knownTokens = new Set<string>([
    ...Object.values(FAMILY_RULES).map((f) => f.baseToken),
    ...ALL_DERIVED_TOKENS.map((t) => t.token),
    // Extra tokens with no derivation rule — override-only.
    "brand-secondary", "alert", "border", "border-subtle", "card-bg",
  ])
  for (const [token, value] of Object.entries(overrides)) {
    if (!knownTokens.has(token) || !isValidHex(value)) continue
    result[`--${token}`] = value.trim()
  }

  return result
}

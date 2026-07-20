import fs from "fs"
import path from "path"

export interface BrandConfig {
  primary?: string
  primaryHover?: string
  dark?: string
  secondary?: string
  background?: string
  text?: string
  alert?: string
  muted?: string
  border?: string
  cardBg?: string
  font?: string
}

export interface StoreAddress {
  line1?: string
  line2?: string
  line3?: string
  city?: string
  county?: string
  postcode?: string
  country?: string
  display_short?: string
  display_full?: string
}

export interface StoreConfig {
  name?: string
  tagline?: string
  logo_url?: string
  favicon_url?: string
  contact_email?: string
  contact_phone?: string
  address?: StoreAddress
}

export interface LandingConfigSection {
  __block: string
  requiredPlugin?: string
  /** Superadmin opt-in: shop-admin can edit this section's content at all. */
  adminEditable?: boolean
  /** Stable identifier a shop-admin edit is stored/looked up against. */
  adminSectionKey?: string
  /** Which named fields on this section are shop-admin editable. */
  adminEditableFields?: string[]
  [key: string]: unknown
}

export interface HomepageConfig {
  showBestSellersCard?: boolean
}

export interface LandingConfig {
  brand?: BrandConfig
  store?: StoreConfig
  plugins?: string[]
  homepage?: HomepageConfig
  sections: LandingConfigSection[]
}

let _config: LandingConfig | null = null

function readConfig(): LandingConfig {
  const configPath = path.join(process.cwd(), "landing-page.config.json")
  const raw = fs.readFileSync(configPath, "utf-8")
  return JSON.parse(raw) as LandingConfig
}

export function getLandingConfig(): LandingConfig {
  if (!_config) {
    _config = readConfig()
  }
  return _config
}

export function getEnabledPlugins(): Set<string> {
  try {
    const config = getLandingConfig()
    if (config.plugins && config.plugins.length > 0)
      return new Set(config.plugins)
  } catch {}
  const raw = process.env.ENABLED_PLUGINS ?? ""
  return new Set(raw.split(",").map(s => s.trim()).filter(Boolean))
}

export function getFilteredSections(): LandingConfigSection[] {
  const config = getLandingConfig()
  const enabled = getEnabledPlugins()
  return config.sections.filter(section => {
    if (!section.requiredPlugin) return true
    return enabled.has(section.requiredPlugin)
  })
}

export function getBrandCss(): string {
  try {
    const b = getLandingConfig().brand
    if (!b) return ""
    const map: Array<[keyof BrandConfig, string]> = [
      ["primary", "--brand"],
      ["primaryHover", "--brand-hover"],
      ["dark", "--brand-dark"],
      ["secondary", "--brand-secondary"],
      ["background", "--bg"],
      ["text", "--fg"],
      ["alert", "--alert"],
      ["muted", "--muted"],
      ["border", "--border"],
      ["cardBg", "--card-bg"],
    ]
    const vars = map
      .filter(([k]) => b[k] != null)
      .map(([k, v]) => `${v}: ${b[k]}`)
    return vars.length ? `:root { ${vars.join("; ")} }` : ""
  } catch {
    return ""
  }
}

export function getStoreConfig(): StoreConfig {
  try {
    return getLandingConfig().store ?? {}
  } catch {
    return {}
  }
}

/** Superadmin homepage switches — structural options a client admin cannot change. */
export function getHomepageConfig(): HomepageConfig {
  try {
    return getLandingConfig().homepage ?? {}
  } catch {
    return {}
  }
}

export function getTopbarSection(): Record<string, unknown> | null {
  try {
    const section = getLandingConfig().sections.find(s => s.__block === 'topbar')
    return section ? (section as Record<string, unknown>) : null
  } catch {
    return null
  }
}

export function getFontLink(): string | null {
  try {
    const font = getLandingConfig().brand?.font
    if (!font || font.toLowerCase() === "poppins") return null
    return `https://fonts.googleapis.com/css2?family=${encodeURIComponent(font)}:wght@400;500;600;700&display=swap`
  } catch {
    return null
  }
}

export interface ContentOverrideEntry {
  overrides: Record<string, string>
  is_hidden: boolean
}

export type ContentOverrideMap = Record<string, ContentOverrideEntry>

/**
 * Layers saved shop-admin edits on top of the config file's own section
 * props. A section with no matching override (or no adminSectionKey at all)
 * passes through unchanged — this is what makes an empty overrides table
 * indistinguishable from "no system present."
 */
export function mergeContentOverrides(
  sections: LandingConfigSection[],
  overridesMap: ContentOverrideMap
): LandingConfigSection[] {
  const merged: LandingConfigSection[] = []
  for (const section of sections) {
    const key = typeof section.adminSectionKey === "string" ? section.adminSectionKey : undefined
    const entry = key ? overridesMap[key] : undefined
    if (!entry) {
      merged.push(section)
      continue
    }
    if (entry.is_hidden) continue
    merged.push({ ...section, ...entry.overrides })
  }
  return merged
}

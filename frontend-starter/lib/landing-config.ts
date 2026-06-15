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

export interface StoreConfig {
  name?: string
  tagline?: string
  logo_url?: string
  favicon_url?: string
  contact_email?: string
  contact_phone?: string
}

export interface LandingConfigSection {
  __block: string
  requiredPlugin?: string
  [key: string]: unknown
}

export interface LandingConfig {
  brand?: BrandConfig
  store?: StoreConfig
  plugins?: string[]
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

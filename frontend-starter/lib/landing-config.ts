import fs from "fs"
import path from "path"

export interface LandingConfigSection {
  __block: string
  requiredPlugin?: string
  [key: string]: unknown
}

export interface LandingConfig {
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

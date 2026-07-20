import type { LandingConfigSection } from "@/lib/landing-config"
import type { LandingRuntimeData } from "@/lib/types"
import { BLOCK_REGISTRY } from '@/lib/block-registry'

// Config-sourced section: __block is top-level, not inside section.content
export function LandingSectionRenderer({ section, data }: { section: LandingConfigSection; data?: LandingRuntimeData }) {
  const entry = BLOCK_REGISTRY[section.__block]
  if (!entry) return null
  const { __block: _, requiredPlugin: __, ...props } = section
  const BlockComponent = entry.component
  if (entry.acceptsData) {
    return <BlockComponent {...props} data={data} />
  }
  return <BlockComponent {...props} />
}

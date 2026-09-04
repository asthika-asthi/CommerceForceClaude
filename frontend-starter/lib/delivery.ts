import type { BrandingConfig } from "./types"

export interface DeliveryWindow {
  earliest: Date
  latest: Date
}

type DeliveryBranding = Pick<
  BrandingConfig,
  "dispatch_days" | "transit_days_min" | "transit_days_max"
>

function addDays(base: Date, days: number): Date {
  const d = new Date(base)
  d.setDate(d.getDate() + days)
  return d
}

/**
 * Indicative estimated-delivery window from the site-wide dispatch/transit settings.
 *
 * `earliest = now + dispatch_days + (transit_days_min ?? transit_days_max)`
 * `latest   = now + dispatch_days + (transit_days_max ?? transit_days_min)`
 *
 * Calendar days only — no order cut-off time, weekends or bank holidays are
 * accounted for. Returns `null` when none of the three settings are configured.
 */
export function estimateDelivery(
  branding: DeliveryBranding | null | undefined,
  now: Date = new Date(),
): DeliveryWindow | null {
  if (!branding) return null
  const dispatch = branding.dispatch_days ?? null
  const transitMin = branding.transit_days_min ?? null
  const transitMax = branding.transit_days_max ?? null
  if (dispatch === null && transitMin === null && transitMax === null) return null

  const dispatchDays = Math.max(0, dispatch ?? 0)
  const minTransit = Math.max(0, transitMin ?? transitMax ?? 0)
  const maxTransit = Math.max(minTransit, transitMax ?? transitMin ?? 0)

  return {
    earliest: addDays(now, dispatchDays + minTransit),
    latest: addDays(now, dispatchDays + maxTransit),
  }
}

const DATE_FMT: Intl.DateTimeFormatOptions = { day: "numeric", month: "short", year: "numeric" }

/** "Sep 7, 2026 – Sep 9, 2026", collapsed to a single date when the window is one day. */
export function formatDeliveryWindow(window: DeliveryWindow, locale = "en-GB"): string {
  const earliest = window.earliest.toLocaleDateString(locale, DATE_FMT)
  const latest = window.latest.toLocaleDateString(locale, DATE_FMT)
  return earliest === latest ? earliest : `${earliest} – ${latest}`
}

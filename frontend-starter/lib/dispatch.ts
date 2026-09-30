/**
 * Homepage dispatch message (trust strip, "how to order", promo banner), edited in
 * admin under Branding → Shop → Delivery & Dispatch. Defaults reproduce the historical
 * copy; an empty string means the store doesn't want to make that promise, so the
 * message is hidden rather than replaced.
 */
export const DEFAULT_DISPATCH_TITLE = "Same Day Despatch"
export const DEFAULT_DISPATCH_SUBTITLE = "Orders placed before 2pm"

export interface DispatchCopy {
  title: string
  subtitle: string
}

export function dispatchCopy(
  branding?: { dispatch_title?: string | null; dispatch_subtitle?: string | null } | null,
): DispatchCopy {
  // `??`, not `||`: "" is a deliberate "hide it", only undefined/null fall back to the default.
  return {
    title: (branding?.dispatch_title ?? DEFAULT_DISPATCH_TITLE).trim(),
    subtitle: (branding?.dispatch_subtitle ?? DEFAULT_DISPATCH_SUBTITLE).trim(),
  }
}

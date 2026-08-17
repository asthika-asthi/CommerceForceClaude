// Mirrors the FONT_OPTIONS values in frontend-starter/lib/fonts.ts — the storefront copy
// is the source of truth (same discipline as theme-colors.ts). Keep these value strings
// identical so a choice made here actually resolves to a loaded font on the storefront.
export const FONT_OPTIONS = [
  { value: "Poppins", label: "Poppins (default)" },
  { value: "Inter", label: "Inter" },
  { value: "Roboto", label: "Roboto" },
  { value: "Open Sans", label: "Open Sans" },
  { value: "Lato", label: "Lato" },
  { value: "Montserrat", label: "Montserrat" },
  { value: "Nunito", label: "Nunito" },
  { value: "Raleway", label: "Raleway" },
  { value: "Playfair Display", label: "Playfair Display" },
  { value: "Merriweather", label: "Merriweather" },
] as const

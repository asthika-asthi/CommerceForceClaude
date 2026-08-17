import {
  Poppins,
  Inter,
  Roboto,
  Open_Sans,
  Lato,
  Montserrat,
  Nunito,
  Raleway,
  Playfair_Display,
  Merriweather,
} from "next/font/google"

// Every font shares the "--font-poppins" CSS variable (see themes/default/globals.css /
// app/globals.css) so switching the active font never requires touching the stylesheet.
const poppins = Poppins({ variable: "--font-poppins", subsets: ["latin"], weight: ["400", "500", "600", "700"] })
const inter = Inter({ variable: "--font-poppins", subsets: ["latin"], weight: ["400", "500", "600", "700"] })
const roboto = Roboto({ variable: "--font-poppins", subsets: ["latin"], weight: ["400", "500", "600", "700"] })
const openSans = Open_Sans({ variable: "--font-poppins", subsets: ["latin"], weight: ["400", "500", "600", "700"] })
const lato = Lato({ variable: "--font-poppins", subsets: ["latin"], weight: ["400", "700"] })
const montserrat = Montserrat({ variable: "--font-poppins", subsets: ["latin"], weight: ["400", "500", "600", "700"] })
const nunito = Nunito({ variable: "--font-poppins", subsets: ["latin"], weight: ["400", "500", "600", "700"] })
const raleway = Raleway({ variable: "--font-poppins", subsets: ["latin"], weight: ["400", "500", "600", "700"] })
const playfairDisplay = Playfair_Display({ variable: "--font-poppins", subsets: ["latin"], weight: ["400", "500", "600", "700"] })
const merriweather = Merriweather({ variable: "--font-poppins", subsets: ["latin"], weight: ["400", "700"] })

export const DEFAULT_FONT = "Poppins"

// Keep values in sync with frontend-admin/lib/font-options.ts — that copy drives the
// branding page dropdown and must offer exactly the fonts loaded here.
export const FONT_OPTIONS = [
  { value: "Poppins", font: poppins },
  { value: "Inter", font: inter },
  { value: "Roboto", font: roboto },
  { value: "Open Sans", font: openSans },
  { value: "Lato", font: lato },
  { value: "Montserrat", font: montserrat },
  { value: "Nunito", font: nunito },
  { value: "Raleway", font: raleway },
  { value: "Playfair Display", font: playfairDisplay },
  { value: "Merriweather", font: merriweather },
] as const

export function resolveFont(fontFamily?: string | null) {
  const match = FONT_OPTIONS.find(f => f.value === fontFamily?.trim())
  return (match ?? FONT_OPTIONS.find(f => f.value === DEFAULT_FONT)!).font
}

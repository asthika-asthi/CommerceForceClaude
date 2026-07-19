# CommerceForce Block Library — Component Reference

Every visual section a client's homepage (or any config-built page) can use,
documented one by one: what it's for, what it looks like, and the exact config
snippet to drop into `landing-page.config.json` → `sections[]` to use it.

This is a reference for **picking and configuring** blocks. For the *process*
of adding a new client, see `docs/add-a-client-ui.md`. For the *architecture*
(why blocks exist, the coarse-wrap history, naturalisation rules), see
`docs/superpowers/specs/2026-07-16-per-client-ui-pipeline-design.md`.

All source lives in `frontend-starter/components/blocks/**`, registered in
`frontend-starter/lib/block-registry.ts`.

---

## How to read this document

**Two families of block:**

1. **Library blocks (37)** — generic, reusable, safe to hand to any client.
   Grouped below by folder: Visual, Commerce, Content, Layout.
2. **Tri Star originals (11, prefixed `landing-`)** — the coarse-wrapped
   pieces of the *current live Tri Star homepage*. They carry Tri Star's exact
   copy and layout decisions baked in (not props-driven the way the library
   blocks are). Reuse them only when a new client wants literally the same
   layout as Tri Star; for anything else, use the generic library blocks
   instead. Documented in their own section at the end.

**Using any block:** add one object to `sections[]` in the client's
`landing-page.config.json`:

```json
{ "__block": "<key-from-this-doc>", "title": "...", "...": "..." }
```

The page renders the list in order through `LandingSectionRenderer` →
`BLOCK_REGISTRY`. No page code is ever touched.

**Two registry flags that change behaviour**, shown per-block below where they apply:

- **`requiredPlugin`** — the block is silently dropped from the page unless its
  plugin is enabled. This is set in **two places** and both must agree: the
  registry entry (fixed, can't be changed per client) AND the config's
  `plugins` array (per client — add the plugin name there to turn the section
  on). The backend's `ENABLED_PLUGINS` only controls whether that plugin's API
  actually works; it does **not** decide whether the section renders.
- **`acceptsData`** — the block receives the homepage's live server-fetched
  `products`/`categories` as a `data` prop automatically. You never pass
  products in config for these; only the four `landing-*` blocks that show
  Tri Star's real catalogue use this (see that section).

**Theming:** every prop that takes a colour, spacing, or size is either plain
content (text/URLs/numbers) or comes from Tailwind utility classes that map to
the named tokens in `themes/default/globals.css` (`--brand`, `--fg`, `--bg`,
etc. — full vocabulary in `frontend-starter/CLAUDE.md`). A block's own code
never hardcodes a client colour; only the *theme file* does. Below, each entry
is flagged:

| Flag | Meaning |
|---|---|
| ✅ **Fully tokenised** | Every colour comes from the client's theme tokens — re-skins automatically, safe for any client incl. dark themes |
| 🌓 **Mostly tokenised** | Tokenised, with a minor grey placeholder (loading skeleton / empty image state) that doesn't reskin — cosmetic only |
| 🌑 **Fixed dark section** | Deliberately renders as a dark panel regardless of the client's theme (mixes `--brand-dark` with hardcoded slate greys) — reads fine on any client, but won't lighten for a pale-branded client |
| 🖼️ **Hero-over-photo** | Requires a background image; white text over a dark overlay is the whole point, not a theme gap |

---

# Visual blocks (`components/blocks/visual/`)

## `spotlight-hero`
**What it's for:** A dark, high-drama homepage hero for clients with a bold/premium/dramatic brand feel — badge, two-part headline, lead + subtitle, two CTAs, optional stat chips underneath. Built for the Surkut pilot; fully generic.

**What it looks like:** Full-width dark section (`--dark-deep` background) with a soft radial brand-colour glow behind the content. At the top, an optional pill-shaped badge with a small pulsing green "live" dot. Below it, a large heading in the client's heading font (falls back to body font if none is set) — the first line in near-white, an optional second line (`titleAccent`) in the brand highlight colour. A lead sentence and a smaller subtitle paragraph follow. Two buttons side by side: a solid brand-coloured primary CTA, and an outlined secondary CTA that lights up gold/brand-coloured on hover. If stat chips are given, they sit below as a row of "big number, small label" pairs (e.g. "3 / Service Tiers").

**Theme:** ✅ Fully tokenised.

**Config usage:**
```json
{
  "__block": "spotlight-hero",
  "badge": "Commissions Open",
  "title": "Your Army, Painted Live.",
  "titleAccent": "With Your Input.",
  "lead": "Watch your miniatures come to life on stream — collaboratively.",
  "subtitle": "No more grey armies. Just beautiful models, painted live.",
  "primaryCtaText": "Request a Commission",
  "primaryCtaUrl": "#commission",
  "secondaryCtaText": "View Portfolio",
  "secondaryCtaUrl": "#portfolio",
  "statChips": [{ "value": "3", "label": "Service Tiers" }],
  "anchorId": "hero"
}
```

**Props:** `badge?`, `title` (required), `titleAccent?`, `lead?`, `subtitle?`, `primaryCtaText?` / `primaryCtaUrl?`, `secondaryCtaText?` / `secondaryCtaUrl?`, `statChips?: {value, label}[]`, `anchorId?` (lets other sections link to it, e.g. `#hero`).

---

## `scroll-expand-hero`
**What it's for:** A cinematic, scroll-driven hero — the media (photo or video) starts small and centred, then visually expands to full width as the visitor scrolls, with the title fading up and away. The most "advanced interaction" hero in the library; good for artistic/premium clients.

**What it looks like:** A tall (1.5 screens) section. While pinned to the viewport: an eyebrow/date line, then a large bold white title and optional subtitle, sitting above a rounded media panel that starts at 60% width and grows to fill the screen (corners squaring off) as you scroll. A "Scroll to explore" hint with an animated pulsing line sits at the bottom, fading out early. Background is either a solid colour (`background`, hex, defaults navy `#0f172a`) or a full-bleed background image (`bgImageSrc`). Supports either an `<img>` or a looping muted `<video>` as the media.

**Theme:** 🌑 Fixed dark by default (background prop is a raw hex, not a token) — set `background` or `bgImageSrc` explicitly per client.

**Config usage:**
```json
{
  "__block": "scroll-expand-hero",
  "mediaType": "image",
  "mediaSrc": "/images/hero.jpg",
  "bgImageSrc": "/images/hero-bg.jpg",
  "title": "Premium Tarpaulins & Covers",
  "eyebrow": "Est. 1995",
  "subtitle": "Heavy-duty protection for industrial, agricultural, and commercial use"
}
```

**Props:** `mediaType?: 'video'|'image'` (default image), `mediaSrc` (required), `posterSrc?` (video poster), `bgImageSrc?`, `background?` (hex, fallback if no bg image), `title` (required), `eyebrow?` (string, or `{text}` object — both accepted), `subtitle?`, `date?` (shown if no eyebrow), `scrollToExpand?` (hint text), `textBlend?` (mix-blend title over media).

---

## `glassmorphism-hero`
**What it's for:** A simpler photo hero with a frosted-glass ("glassmorphism") content card floating over the background image — trendy, clean, works well for lifestyle/retail clients.

**What it looks like:** Full-bleed background photo with a dark tint overlay (opacity configurable). Centred on top: a semi-transparent white card with heavy blur and a soft border — the "frosted glass" panel — containing a bold white heading, optional subtitle, and a solid white pill button.

**Theme:** 🖼️ Hero-over-photo (white text/glass panel by design).

**Config usage:**
```json
{
  "__block": "glassmorphism-hero",
  "backgroundImage": "/images/hero-bg.jpg",
  "title": "Elevate Your Space",
  "subtitle": "Curated furniture for modern living",
  "ctaText": "Shop the Collection",
  "ctaUrl": "/products",
  "overlayOpacity": 0.4
}
```

**Props:** `backgroundImage` (required), `title` (required), `subtitle?`, `ctaText?` + `ctaUrl?` (both needed to show the button), `overlayOpacity?` (0–1, default 0.4).

---

## `parallax-banner`
**What it's for:** A mid-page CTA banner with a fixed-background parallax photo effect — background image stays still while content scrolls over it. Good for a "Need something custom? Get in touch" style break between sections.

**What it looks like:** A photo section (configurable min-height) with a dark overlay, centred white heading + subtitle + a brand-coloured button. On iOS, the parallax "fixed" effect silently degrades to a normal static background (documented limitation, not a bug).

**Theme:** 🖼️ Hero-over-photo.

**Config usage:**
```json
{
  "__block": "parallax-banner",
  "backgroundImage": "/images/cta-bg.jpg",
  "title": "Need a Custom Size?",
  "subtitle": "We cut to measure — any shape, any size.",
  "ctaText": "Get a Quote",
  "ctaUrl": "/contact",
  "minHeight": "400px"
}
```

**Props:** `backgroundImage` (required), `title` (required), `subtitle?`, `ctaText?` + `ctaUrl?`, `overlayOpacity?` (default 0.5), `minHeight?` (CSS length, default `400px`).

---

## `marquee-ticker`
**What it's for:** A thin, continuously scrolling strip of short text items — press mentions, delivery guarantees, "as seen in" logos-as-text, or promo call-outs. Purely decorative/attention strip, not a hero.

**What it looks like:** A slim horizontal band, background solid colour (default `--brand-dark`), with items scrolling right-to-left forever, separated by a subtle "·" (or custom separator). Speed and colours are configurable per instance.

**Theme:** ✅ Fully tokenised (background/text colours default to tokens, overridable via raw CSS colour string if truly needed).

**Config usage:**
```json
{
  "__block": "marquee-ticker",
  "items": ["Free UK delivery over £75", "Same-day despatch before 2pm", "30 years trading"],
  "speed": 40,
  "separator": "·"
}
```

**Props:** `items: string[]` (required — returns nothing if empty), `speed?` (higher = faster, default 40), `backgroundColor?`, `textColor?` (raw CSS colour overrides), `separator?` (default `·`).

---

## `gradient-text-section`
**What it's for:** A big, bold, brand-gradient headline as its own standalone statement section — a strong visual full-stop between denser sections, e.g. "Built to last." with a CTA underneath.

**What it looks like:** Centred, huge (up to 7xl) heading with the text itself filled by a left-to-right gradient (defaults brand → brand-dark), a smaller subtitle, and an optional button below.

**Theme:** ✅ Fully tokenised (gradient defaults to brand tokens; can be overridden with any CSS colour string).

**Config usage:**
```json
{
  "__block": "gradient-text-section",
  "title": "Built to last.",
  "subtitle": "Every piece hand-finished in our UK workshop.",
  "ctaText": "See the range",
  "ctaUrl": "/products"
}
```

**Props:** `title` (required), `subtitle?`, `ctaText?` + `ctaUrl?`, `gradientFrom?` / `gradientTo?` (raw CSS colours, default to brand tokens).

---

## `image-mosaic`
**What it's for:** A Pinterest-style grid of up to 6 images (e.g. workshop photos, lifestyle shots, Instagram-style gallery) with one tall "hero" tile per row of three. Simpler and more static than `showcase-gallery` (no captions/badges).

**What it looks like:** A responsive 2–3 column grid, each cell a rounded image tile that zooms slightly on hover; every third tile spans two rows (creates the mosaic rhythm). Optional linkUrl makes a tile clickable.

**Theme:** ✅ Fully tokenised section background; image tiles are photos (no themable surface needed).

**Config usage:**
```json
{
  "__block": "image-mosaic",
  "title": "In the Workshop",
  "images": [
    { "src": "/images/workshop-1.jpg", "alt": "Hand-finishing a frame" },
    { "src": "/images/workshop-2.jpg", "alt": "Raw timber selection", "linkUrl": "/about" }
  ]
}
```

**Props:** `images: {src, alt, linkUrl?}[]` (required, returns nothing if empty — max 6 shown), `title?`.

---

## `promotions-banner`
**What it's for:** Shows the currently active promotion, if any, pulled **live from the backend** (`/api/promotions/active`) — not config-authored copy. Use this when the client runs the `promotions` plugin and wants the homepage to reflect whatever promotion is live in the admin panel, without a redeploy.

**What it looks like:** A solid dark band (`--brand-dark`) with a centred headline, body text, an optional "offer ends [date]" line, and a brand-coloured button. Renders **nothing at all** if there's no active promotion or the plugin/API call fails — safe to always include in a config.

**Theme:** ✅ Fully tokenised.

**Config usage:**
```json
{ "__block": "promotions-banner", "requiredPlugin": "promotions" }
```

**Props:** none (server component; fetches its own data).

---

## `shiny-button`
**What it's for:** A single, eye-catching animated CTA button as its own full-width section — used to punctuate a page with one big "Register now" moment rather than as part of another block.

**What it looks like:** An oval button with an animated rotating rainbow-glow border (orange→transparent→blue, softly blurred, intensifies on hover) around a near-black pill containing the label. It's the same button component (`GlowButton`) used inside `cta-banner`.

**Theme:** ✅ Effectively theme-agnostic (the glow is a deliberate multi-colour effect, not brand-tokenised — this is one of the repo's documented decorative-gradient exceptions to the "never hardcode colour" rule).

**Config usage:**
```json
{ "__block": "shiny-button", "children": "Register for Trade", "href": "/register" }
```

**Props:** `children?` (button label, default "Register"), `href?` (if set, wraps in a link).

---

## `glowing-shadow`
**What it's for:** A decorative "glow card" wrapper — a rounded dark card with an animated rotating colour-cycling glow halo behind it, revealed on hover. Used to make any short piece of content (badge, small CTA, highlight) feel premium/interactive. It's a generic wrapper, not content-specific.

**What it looks like:** A dark near-black rounded rectangle, cursor set to pointer, with a soft multi-hue glow rotating and pulsing behind/around it; on hover the glow intensifies and the card's inner blend mode shifts to make the content read in white.

**Theme:** ✅ Theme-agnostic decorative effect (same documented exception as `shiny-button`).

**Config usage:**
```json
{ "__block": "glowing-shadow", "children": "New season, new colours" }
```

**Props:** `children` (required — any text/markup passed as the config value; note: only plain strings are practical from JSON config).

---

# Commerce blocks (`components/blocks/commerce/`)

## `pricing-tiers`
**What it's for:** Side-by-side service/product tier cards with feature lists — the natural fit for any client selling tiered services (commissions, subscriptions, packages) rather than a plain product catalogue. Built for the Surkut pilot; fully generic.

**What it looks like:** A light section with a centred kicker/title/subtitle, then three (or more) cards in a row. Each card: tier name, an optional tagline, an audience line, a "how it's priced" note, a bullet list of features (✦ marker), a price note, and a CTA button. The recommended tier can be flagged `highlight: true` — it gets a brand-coloured border, a subtle shadow, and a "Most Popular" pill badge floating above its top edge; its button is solid brand-coloured while the others are outlined.

**Theme:** ✅ Fully tokenised.

**Config usage:**
```json
{
  "__block": "pricing-tiers",
  "kicker": "What I offer",
  "title": "Choose Your Commission Tier",
  "tiers": [
    {
      "name": "Tabletop Tier",
      "tagline": "Fast. Clean. Battle-Ready.",
      "pricingBasis": "Quoted per model",
      "features": ["Solid base colours", "Basic shading"],
      "priceNote": "Starts at £10 per model",
      "ctaText": "Get a Quote",
      "ctaUrl": "#commission"
    },
    { "name": "Premium Tier", "highlight": true, "highlightLabel": "Most Popular", "...": "..." }
  ]
}
```

**Props:** `kicker?`, `title` (required), `subtitle?`, `anchorId?`, `tiers: TierCard[]` (required) where each tier is `{ name, tagline?, audience?, pricingBasis?, features?: string[], priceNote?, highlight?, highlightLabel? (default "Most Popular"), ctaText?, ctaUrl? }`.

---

## `enquiry-form`
**What it's for:** A lead/enquiry capture form (name, email, custom subject/detail fields, message) that posts straight to the existing **`contact` plugin** backend (`POST /api/contact`) — for clients selling bespoke/quoted work rather than instant checkout (commissions, custom orders, consultations). Submissions land in the admin panel under Enquiries.

**What it looks like:** Two-column layout: a left sidebar with a heading, supporting copy, an optional urgency note, and a list of external links (socials, etc.); on the right, the form itself — name/email, an optional dropdown ("Service Tier" or similar), any number of extra one-line detail fields you define, and a required message textarea. On submit, the whole right column is replaced by a green success message. Errors show inline in red without losing the filled-in fields.

**Theme:** ✅ Fully tokenised.

**Requires:** `contact` plugin — **must be listed in the config's `plugins` array** (registry already sets `requiredPlugin: 'contact'`) or the section is silently dropped, and the backend's `ENABLED_PLUGINS` must also include `contact` for the POST to succeed.

**Config usage:**
```json
{
  "__block": "enquiry-form",
  "requiredPlugin": "contact",
  "title": "Request a Commission",
  "sidebarHeading": "Let's Bring Your Vision to Life",
  "sidebarLinks": [{ "label": "Instagram", "href": "https://instagram.com/..." }],
  "subjectLabel": "Service Tier",
  "subjectOptions": ["Tabletop Tier", "Premium Tier"],
  "detailFields": ["Game System", "Number of Models"],
  "messageLabel": "Project Description",
  "submitLabel": "Submit Commission Request",
  "successMessage": "Thank you! I'll be in touch within 48 hours."
}
```

**Props:** `kicker?`, `title` (required), `subtitle?`, `anchorId?`, `sidebarHeading?` / `sidebarBody?` / `urgencyNote?` / `sidebarLinks?: {label, href}[]`, `subjectLabel?` (default "Subject") / `subjectOptions?: string[]` (omit to hide the dropdown entirely), `detailFields?: string[]` (each becomes a plain text input, folded into the message body on submit), `messageLabel?` (default "Message"), `submitLabel?` (default "Send enquiry"), `successMessage?`, `footnote?` (small print under the button).

---

## `featured-products-grid`
**What it's for:** A self-contained "Featured Products" section that fetches its own data client-side (`GET /api/products?featured_only=true`) — use this when you want a product grid **without** wiring it through the homepage's server-fetched `data` prop (i.e., anywhere other than the main `landing-hero`/`landing-product-grid` pipeline, or on any non-homepage page built from blocks).

**What it looks like:** Centred heading/subtitle, then a responsive 2–4 column grid of product cards (image, name, price with strikethrough if on sale, an Add-to-cart button that shows a spinner→"Added"/"Try again" state). Shows animated grey skeleton cards while loading, a friendly empty state if there are no featured products, and a "View all products" button at the end.

**Theme:** 🌓 Mostly tokenised (skeleton/placeholder greys are hardcoded slate, cosmetic only).

**Config usage:**
```json
{ "__block": "featured-products-grid", "title": "Featured Products", "maxProducts": 8 }
```

**Props:** `title?` (default "Featured Products"), `subtitle?`, `maxProducts?` (default 8).

---

## `category-grid`
**What it's for:** A config-authored (not live-fetched) category showcase — you supply the category list, icon/emoji, and gradient background per card directly in JSON. Use when you want full manual control over which categories show and their exact look, rather than pulling every active backend category automatically (compare to `landing-category-grid`, which *does* pull live).

**What it looks like:** A heading + "see all" link row, then a 2–4 column grid of cards: a coloured icon/emoji tile on top (custom gradient per category, falls back to a neutral grey gradient), category name, optional description, optional product-count badge, and an optional CTA line.

**Theme:** ✅ Fully tokenised (card surface); the per-category `imgGradient` values are content, not theme.

**Config usage:**
```json
{
  "__block": "category-grid",
  "title": "Shop by category",
  "seeAllLabel": "All categories",
  "seeAllHref": "/products",
  "categories": [
    { "name": "Tarpaulins", "icon": "🛡️", "href": "/products?category=tarps", "productCount": 24 }
  ]
}
```

**Props:** `title?`, `seeAllLabel?` / `seeAllHref?` (both needed to show the link), `categories?: {id?, name, href?, icon?, imgGradient?, productCount?, description?, cta?}[]`.

---

## `trust-strip`
**What it's for:** A thin row of trust badges under the hero — delivery promise, guarantee, certifications, whatever reassurance points the client wants up front. Config-authored (compare `landing-trust-strip`, which is Tri Star's fixed 5-item version).

**What it looks like:** A slim white/card-coloured bar with a bottom border, holding several icon + heading + small-print items spread across the row (wraps on mobile).

**Theme:** ✅ Fully tokenised.

**Config usage:**
```json
{
  "__block": "trust-strip",
  "items": [
    { "icon": "🚚", "heading": "Free UK Delivery", "subtext": "On orders over £75" }
  ]
}
```

**Props:** `items?: {icon, heading, subtext?}[]`.

---

## `product-range-table`
**What it's for:** A compact reference table of the client's product range (product / category / sizes / use case / availability) — useful for trade/B2B clients whose customers want a scannable spec sheet rather than a visual grid. Config-authored (compare `landing-range-table`, which auto-populates from live products).

**What it looks like:** A heading + "see all" link, then a bordered card containing a table: dark header row (client's `--brand-dark`), zebra-striped body rows, and a coloured pill per row showing "In stock" (green) or "Limited qty" (amber) — colours and labels are configurable, defaults shown.

**Theme:** ✅ Fully tokenised (row status pill colours are configurable content, not raw hardcodes forced on the client).

**Config usage:**
```json
{
  "__block": "product-range-table",
  "title": "Product range quick reference",
  "rows": [
    { "product": "Cotton Dust Sheet", "category": "Dust Sheets", "sizes": "3×4m, 4×5m", "useCase": "Decorating", "availability": "in-stock" }
  ]
}
```

**Props:** `title?`, `seeAllLabel?` / `seeAllHref?`, `columns?: string[]` (header labels, sensible defaults given), `rows?: {product, category?, sizes?, useCase?, availability?}[]`, `statusInStock?` / `statusLimited?: {label, color, bg}` (override the two status pill styles).

---

## `coupon-spotlight`
**What it's for:** Shows the currently featured coupon code, if any, pulled **live from the backend** (`/api/coupons/featured`) — same live-data pattern as `promotions-banner`. Use when the client runs the `coupons` plugin and wants a homepage call-out for whatever code is currently marked "featured" in admin.

**What it looks like:** A centred "Exclusive Offer" panel with a large discount headline ("20% OFF"), a dashed-border card containing the monospace coupon code in a highlighted pill, and an optional expiry date. Renders nothing if there's no featured coupon.

**Theme:** ✅ Fully tokenised.

**Config usage:**
```json
{ "__block": "coupon-spotlight", "requiredPlugin": "coupons" }
```

**Props:** none (server component; fetches its own data).

---

## `loyalty-widget`
**What it's for:** A homepage loyalty-programme call-out that **changes based on who's viewing it** — logged-out visitors see a "join and earn points" pitch; logged-in members see their actual points balance pulled live from `/api/loyalty/me`. Requires the `loyalty` plugin.

**What it looks like:** A full-width dark gradient section. Guests: an icon, a bold headline/subtitle (config-authored), a bulleted benefits list, and a "join" button, plus a "already a member? Sign in" line. Logged-in members: a star badge, "Your Loyalty Points" heading, three stat cards (Available Balance / Total Earned / Total Redeemed), and an "Earn more points" button. Shows a spinner while checking auth/loyalty status, and a quiet fallback message if the loyalty API call fails.

**Theme:** 🌑 Fixed dark section (gradient mixes `--brand-dark` with hardcoded slate).

**Requires:** `loyalty` plugin.

**Config usage:**
```json
{
  "__block": "loyalty-widget",
  "requiredPlugin": "loyalty",
  "title": "Loyalty Rewards",
  "subtitle": "Join our loyalty program and start earning points on every purchase.",
  "joinCtaText": "Start earning points today",
  "joinCtaUrl": "/register"
}
```

**Props:** `title?`, `subtitle?`, `joinCtaText?`, `joinCtaUrl?` (all only used for the guest view — the logged-in view is entirely account data).

---

# Content blocks (`components/blocks/content/`)

## `showcase-gallery`
**What it's for:** A portfolio/gallery grid with per-item badges and "coming soon" placeholder slots — built for showing off finished work (commissions, projects, case studies) rather than products for sale. Built for the Surkut pilot; fully generic.

**What it looks like:** A heading row, then a responsive 2–4 column grid of image cards. Each real item: a photo that zooms slightly on hover, a caption overlay (title + small tag) fading up from a dark gradient at the bottom, and an optional coloured badge pinned to the top-right corner (e.g. "Premium Tier"). Items marked `comingSoon: true` (or with no image) instead show a plain card with just a title and small "coming soon" caption — no photo needed, useful as a permanent "your project here" call-to-action slot.

**Theme:** ✅ Fully tokenised (the caption gradient/white text sits directly on a photo — a documented, intentional exception).

**Config usage:**
```json
{
  "__block": "showcase-gallery",
  "kicker": "My work",
  "title": "The Portfolio",
  "items": [
    { "image": "/images/portfolio-1.jpg", "title": "RPG Drone Corp", "tag": "Sci-Fi Skirmish", "badge": "Premium Tier" },
    { "title": "Your commission here", "comingSoon": true, "comingSoonText": "Slots Available Now" }
  ]
}
```

**Props:** `kicker?`, `title` (required), `subtitle?`, `anchorId?`, `items: {image?, imageAlt?, title, tag?, badge?, comingSoon?, comingSoonText?}[]` (required).

---

## `video-showcase`
**What it's for:** A grid of short video clips with captions — behind-the-scenes footage, process clips, product demos. Uses plain native `<video>` (no external player/embed), so it works offline and needs no third-party script. Built for the Surkut pilot; fully generic.

**What it looks like:** A heading row, then a 2-column grid of bordered cards, each holding a native video player (with visible controls, black background while loading) and a small caption + tag underneath.

**Theme:** ✅ Fully tokenised.

**Config usage:**
```json
{
  "__block": "video-showcase",
  "kicker": "In action",
  "title": "Watch the Process",
  "videos": [
    { "src": "/videos/clip-1.mp4", "caption": "Commission in Progress", "tag": "Live stream clip" }
  ]
}
```

**Props:** `kicker?`, `title` (required), `subtitle?`, `anchorId?`, `videos: {src, caption?, tag?}[]` (required).

---

## `stream-spotlight`
**What it's for:** A "we stream/broadcast this live" call-out panel — built originally for a Twitch-streaming miniature painter, but generic enough for any client who does live demonstrations, webinars, or livestream events. Links out to the external channel rather than embedding it (embeds need a registered parent domain and break in local dev).

**What it looks like:** A dark two-column section. Left: a clickable stylised "stream preview" panel — a dark card with a soft glowing radial background, a pulsing red "LIVE" badge top-left, and centred panel title/subtitle plus a CTA pill, all linking out to the channel URL in a new tab. Right: a kicker, heading, a bulleted pitch list (✦ markers), and the channel name as a text link.

**Theme:** 🌑 Fixed dark section (by design — the whole point is a "live stream" mood).

**Config usage:**
```json
{
  "__block": "stream-spotlight",
  "kicker": "Live Streaming",
  "title": "Your Model, Painted Live. On Stream.",
  "bullets": ["Watch in real time", "Vote on colour choices", "Chat directly with the artist"],
  "channelName": "twitch.tv/yourchannel",
  "channelUrl": "https://twitch.tv/yourchannel",
  "panelTitle": "Painting Your Commission Live",
  "ctaText": "Tune in"
}
```

**Props:** `kicker?`, `title` (required), `bullets?: string[]`, `channelName?` / `channelUrl?`, `panelTitle?` / `panelSubtitle?`, `ctaText?` (default "Watch live"), `anchorId?`.

---

## `faq-accordion`
**What it's for:** A standard FAQ section — collapsible question/answer pairs. Uses native HTML `<details>/<summary>`, so it needs zero JavaScript, works with keyboards out of the box, and degrades gracefully (still readable if CSS fails).

**What it looks like:** A centred heading, then a stack of rounded bordered panels — each showing just the question with a small "+" that rotates 45° into an "×" when expanded, revealing the answer text below.

**Theme:** ✅ Fully tokenised.

**Config usage:**
```json
{
  "__block": "faq-accordion",
  "kicker": "Questions",
  "title": "Frequently Asked.",
  "items": [
    { "question": "How do I request a commission?", "answer": "Fill out the form below..." }
  ]
}
```

**Props:** `kicker?`, `title` (required), `items: {question, answer}[]` (required), `anchorId?`.

---

## `bento-grid`
**What it's for:** An asymmetric "bento box" card grid — good for audience/persona segments ("who this is for"), feature highlights, or any set of 3–4 items where one or two deserve visual emphasis over the others.

**What it looks like:** A 2–3 column grid where `size: "large"` cards span two columns and two rows (bigger image, bigger title), and `size: "small"` cards are compact — all in bordered card-coloured tiles with an optional image, a heading, a clamped body paragraph, and an optional "link text →" at the bottom. Maximum 4 cards shown even if more are supplied. Each card fades and slides up the first time it scrolls into view, staggered slightly card-to-card (`ScrollReveal`).

**Theme:** ✅ Fully tokenised.

**Config usage:**
```json
{
  "__block": "bento-grid",
  "title": "Your People.",
  "cards": [
    { "title": "Warhammer / Wargamers", "body": "You buy armies worth £300+...", "size": "large" },
    { "title": "D&D Dungeon Masters", "body": "You run campaigns...", "size": "small" }
  ]
}
```

**Props:** `title?`, `cards: {title, body, image?, linkUrl?, linkText?, size: 'large'|'small'}[]` (required, max 4 rendered).

---

## `how-to-order` *(library version)*
**What it's for:** A numbered "how it works" step sequence — order process, onboarding steps, commission workflow. Config-authored steps (compare `landing-how-to-order`, Tri Star's fixed 4-step version).

**What it looks like:** A centred heading, then 4 (or 5 — the grid auto-adjusts column count for exactly 5 steps) numbered circles connected by a horizontal brand-gradient line (hidden on mobile), each with a bold step title and a short description underneath.

**Theme:** ✅ Fully tokenised.

**Config usage:**
```json
{
  "__block": "how-to-order",
  "title": "The Commission Process",
  "steps": [
    { "number": 1, "title": "Submit a Request", "description": "Fill in the commission form..." }
  ]
}
```

**Props:** `title?` (default "How to order from us"), `steps?: {number?, title?, description?}[]`.

---

## `stats-band` *(library version)*
**What it's for:** A dark strip of big statistics (years trading, products sold, delivery threshold, etc.) — a quick-trust "by the numbers" moment. Config-authored (compare `landing-stats-band`, Tri Star's fixed 4-stat version).

**What it looks like:** A solid `--brand-dark` band with 2–4 columns of huge bold numbers (optional prefix/suffix in the brand accent colour) and a small caption underneath each.

**Theme:** ✅ Fully tokenised.

**Config usage:**
```json
{
  "__block": "stats-band",
  "stats": [{ "number": "30", "suffix": "+", "label": "Years supplying UK trade & retail" }]
}
```

**Props:** `stats?: {prefix?, number?, suffix?, label?}[]`.

---

## `testimonials-carousel`
**What it's for:** An auto-advancing, swipeable single-testimonial carousel with prev/next arrows and dot indicators — use when you want one review "on stage" at a time rather than a static 3-across grid (compare `landing-testimonials`, which is a fixed 3-card grid + Trustpilot bar).

**What it looks like:** A dark full-width section. A centred quote card (rounded, subtly bordered) slides in from left/right on each transition: a small quote-mark icon, the testimonial in large italic serif-weight text, then the reviewer's avatar (photo, or auto-generated initials in a brand-coloured circle) with name and role. Auto-advances every few seconds (default 4s), pauses on hover, and has left/right arrow buttons plus clickable dots below.

**Theme:** 🌑 Fixed dark section (`bg-slate-900`).

**Config usage:**
```json
{
  "__block": "testimonials-carousel",
  "title": "What Our Customers Say",
  "testimonials": [{ "name": "David W.", "role": "Contractor, Luton", "quote": "We've ordered for 12 years..." }],
  "autoAdvanceMs": 4000
}
```

**Props:** `title?` (default "What Our Customers Say"), `subtitle?`, `testimonials: {name, role?, quote, avatar?}[]` (required, returns nothing if empty), `autoAdvanceMs?` (default 4000; carousel doesn't auto-advance with fewer than 2 testimonials).

---

## `newsletter-section`
**What it's for:** An email sign-up section with its own form state and validation, posting to `/api/newsletter/subscribe` — the generic, config-authored version (compare `landing/newsletter.tsx`, the Tri Star original wrapped as `landing-newsletter`, which is plugin-gated and has fixed Tri Star copy).

**What it looks like:** A full-width dark section — either a background photo (if `backgroundImage` given) or a brand-to-slate gradient — with a dark overlay, a small mail-icon badge, a large bold heading/subtitle, then an email input + Subscribe button side by side. On success, the form is replaced with a green checkmark + "You're subscribed!" message; on error, a red inline warning appears without losing the typed email.

**Theme:** 🌑 Fixed dark section by default (fallback gradient blends `--brand-dark` with hardcoded slate); fully photographic if `backgroundImage` is set.

**Config usage:**
```json
{ "__block": "newsletter-section", "title": "Stay in the loop", "buttonText": "Subscribe" }
```

**Props:** `title?` (default "Stay in the loop"), `subtitle?`, `backgroundImage?`, `buttonText?` (default "Subscribe"). Note: this block posts directly — it does **not** need `requiredPlugin` set for itself to render (unlike `landing-newsletter`, which is plugin-gated); consider gating it manually in config if the client doesn't run a newsletter plugin, since the POST will simply fail silently into the error state otherwise.

---

## `cta-banner`
**What it's for:** A general-purpose mid-page call-to-action banner with a subtle parallax background and scroll-triggered fade — a lighter-weight cousin of `parallax-banner`/`scroll-expand-hero`, good as a section break anywhere on any page.

**What it looks like:** A tall section with a background image (or a brand-dark-to-slate gradient fallback) that drifts slowly as you scroll past, under a dark overlay. Centred content — a small decorative rule (line–dot–line), a large bold white heading, an optional subtitle, and a `GlowButton` (the same animated rainbow-glow button used in `shiny-button`) — fades in as the section enters view and fades out as it leaves.

**Theme:** 🌑 Fixed dark fallback if no `backgroundImage`; 🖼️ hero-over-photo if one is given.

**Config usage:**
```json
{ "__block": "cta-banner", "title": "Need a Custom Size?", "ctaText": "Get a Quote", "ctaUrl": "/contact" }
```

**Props:** `title` (required), `subtitle?`, `ctaText?` (default "Shop Now"), `ctaUrl?` (default "/products"), `backgroundImage?`.

---

## `dual-cta-banner`
**What it's for:** Two side-by-side coloured promo cards — classically "become a trade customer" + "need something bespoke", i.e. two distinct calls-to-action that deserve equal visual weight (compare Tri Star's fixed version, `landing-split-cards`).

**What it looks like:** Two rounded cards side by side (stacked on mobile), each a solid colour (defaults to `--brand-dark`, fully overridable per card via `bg`) with a subtle decorative translucent circle in the bottom corner, an uppercase eyebrow line, a bold heading, a body paragraph, a row of small pill-shaped feature tags, and a button whose background/text colour you set per card.

**Theme:** ✅ Fully tokenised (card colours default to `--brand-dark` but are fully overridable content per card, not a hardcode).

**Config usage:**
```json
{
  "cards": [
    {
      "eyebrow": "For businesses & contractors",
      "title": "Open a trade account",
      "body": "Register for wholesale pricing and monthly invoicing.",
      "features": ["Wholesale pricing", "30-day terms"],
      "ctaLabel": "Register for trade →",
      "ctaHref": "/register"
    }
  ]
}
```
(then wrap with `"__block": "dual-cta-banner"`)

**Props:** `cards?: {bg?, eyebrow?, title?, body?, features?: string[], ctaLabel?, ctaHref?, btnBg?, btnText?}[]`.

---

## `split-image-text`
**What it's for:** A classic "photo on one side, story on the other" section — brand story, "meet the maker", a featured product highlight. Image position is switchable per instance.

**What it looks like:** A two-column layout (stacks on mobile): a square rounded photo on one side, and on the other a bold heading, a paragraph of body copy, and an optional button. `imagePosition: "right"` flips which side the photo sits on.

**Theme:** 🌓 Mostly tokenised (image placeholder background is a neutral grey while the photo loads/if broken).

**Config usage:**
```json
{
  "__block": "split-image-text",
  "image": "/images/workshop.jpg",
  "imageAlt": "Our workshop",
  "title": "Handmade, Start to Finish",
  "body": "Every piece begins as raw timber and leaves as a finished heirloom.",
  "ctaText": "Meet the maker",
  "ctaUrl": "/about",
  "imagePosition": "left"
}
```

**Props:** `image` + `imageAlt` (required), `title` (required), `body` (required), `ctaText?` + `ctaUrl?`, `imagePosition?: 'left'|'right'` (default left).

---

## `animated-counter`
**What it's for:** A row of big numbers that visually count up from zero to their target value the moment they scroll into view — a more "alive" alternative to the static `stats-band` for the same kind of content (years trading, orders shipped, customers served).

**What it looks like:** A centred heading, then 2–4 columns of huge bold numbers (in `--brand-dark`) with a small uppercase label underneath each; each number animates from 0 up to its value over about 1.5 seconds, once, the first time it's scrolled into view.

**Theme:** ✅ Fully tokenised.

**Config usage:**
```json
{
  "__block": "animated-counter",
  "title": "By the numbers",
  "stats": [{ "value": 30, "suffix": "+", "label": "Years trading" }]
}
```

**Props:** `title?`, `stats: {value: number, label: string, prefix?, suffix?}[]` (required, returns nothing if empty, max 4 shown).

---

## `button-group`
**What it's for:** A standalone row of buttons with no other content — a lightweight "pick one of these paths" section, e.g. "Shop Men's / Shop Women's / Shop Kids" as three plain CTAs with no imagery.

**What it looks like:** A simple flex row of pill buttons, alignment configurable (left/center/right), each styled as primary (solid brand), secondary (solid `--brand-secondary`), or outline (brand-coloured border, transparent fill, tints on hover) per button.

**Theme:** ✅ Fully tokenised.

**Config usage:**
```json
{
  "__block": "button-group",
  "alignment": "center",
  "buttons": [
    { "label": "Shop Men's", "url": "/products?category=mens", "variant": "primary" },
    { "label": "Shop Women's", "url": "/products?category=womens", "variant": "outline" }
  ]
}
```

**Props:** `buttons?: {label, url, variant?: 'primary'|'secondary'|'outline'}[]`, `alignment?: 'left'|'center'|'right'` (default center).

---

# Layout blocks (`components/blocks/layout/`)

These render structural chrome (nav, footer, menu). In practice the storefront's real navbar/footer (`components/layout/navbar.tsx`, `footer.tsx`) are separate, always-on components outside the block pipeline — these registry entries exist for building **alternative or supplementary** nav/footer sections directly into a page's `sections[]` (e.g. a secondary in-page menu, or a fully custom footer block on a landing page that bypasses the site chrome).

## `tubelight-navbar`
**What it's for:** A modern floating pill-shaped bottom navigation bar with an animated "lamp" glow under the active item — a distinctive mobile-app-like nav treatment, not the site's main navbar.

**What it looks like:** Fixed to the bottom-centre of the screen: a translucent blurred pill containing nav items as text labels (icons only on small screens). The active item's pill background lights up and a small glowing bar ("lamp") smoothly slides beneath whichever item is active, using a spring animation.

**Theme:** ✅ Fully tokenised (uses the shadcn-compatible `primary`/`card-bg`/`border` aliases).

**Config usage:**
```json
{
  "__block": "tubelight-navbar",
  "items": [{ "name": "Home", "url": "/", "icon": "Home" }, { "name": "Shop", "url": "/products", "icon": "ShoppingCart" }]
}
```

**Props:** `items?: {name, url, icon: string}[]` — icon names map to a fixed Lucide icon set (`Home, User, Briefcase, FileText, ShoppingCart, Heart, Search, Menu, Star, Settings, Bell, Info, Tag, Package`; unrecognised names fall back to `Home`). Renders nothing if `items` is empty.

---

## `announcement-bar`
**What it's for:** A thin, site-wide announcement strip pulled **live from the backend** (`/api/announcements/active`) — for time-sensitive messages an admin can turn on/off without a redeploy ("Bank holiday delivery notice", etc.).

**What it looks like:** A slim solid-brand-coloured bar with centred text and an optional underlined "Learn more" link. Renders nothing if there's no active announcement.

**Theme:** ✅ Fully tokenised.

**Config usage:**
```json
{ "__block": "announcement-bar", "requiredPlugin": "announcements" }
```

**Props:** none (server component; fetches its own data).

---

## `navbar`
**What it's for:** A basic in-page navbar block (logo, links, one CTA) — for building an alternative or supplementary nav directly into a page's `sections[]`. The site's real navbar (`components/layout/navbar.tsx`) is a separate, always-on component and unaffected by this.

**What it looks like:** A card-coloured bar: bold logo text on the left, a row of nav links in the middle (desktop only), and an optional brand-coloured CTA button on the right.

**Theme:** ✅ Fully tokenised.

**Config usage:**
```json
{ "__block": "navbar", "logoText": "My Store", "links": [{ "label": "Shop", "url": "/products" }] }
```

**Props:** `logoText?` (default "Store"), `logoUrl?` (default "/"), `links?: {label, url}[]`, `ctaLabel?` + `ctaUrl?`.

---

## `footer`
**What it's for:** A basic multi-column footer block — same use case as `navbar`. The site's real footer (`components/layout/footer.tsx`) is what actually ships; this registry entry is for a standalone footer-shaped block inside a page's `sections[]` if ever needed.

**What it looks like:** A dark footer: logo/tagline on the left, up to several link columns to the right, and a thin copyright line along the bottom.

**Theme:** ✅ Fully tokenised.

**Config usage:**
```json
{ "__block": "footer", "logoText": "My Store", "columns": [{ "heading": "Shop", "links": [{ "label": "All Products", "url": "/products" }] }] }
```

**Props:** `logoText?` (default "Store"), `tagline?`, `columns?: {heading, links: {label, url}[]}[]`, `copyrightText?`.

---

## `menu`
**What it's for:** A simple labelled link list — a sitemap-style menu block, or a small in-page nav section (e.g. "Jump to: Products / Reviews / FAQ").

**What it looks like:** An optional small uppercase label, then a list of links in one of three layouts (`horizontal`, `vertical`, or a `grid`); each item can optionally have nested sub-links shown indented underneath it.

**Theme:** ✅ Fully tokenised.

**Config usage:**
```json
{ "__block": "menu", "title": "Quick Links", "layout": "horizontal", "items": [{ "label": "Products", "url": "/products" }] }
```

**Props:** `title?`, `items?: {label, url, children?: {label, url}[]}[]`, `layout?: 'horizontal'|'vertical'|'grid'` (default horizontal).

---

# Tri Star originals (`landing-*`)

These 11 blocks wrap the **original, hand-built Tri Star homepage components** one-for-one (see Phase 1's "coarse wrap" in the pipeline spec). They render Tri Star's exact copy and layout — most take little or no config beyond structural props, because the wording is baked into the component, not passed in. **Prefer the generic library blocks above for a new client**; reuse these only when a client explicitly wants Tri Star's exact page shape as a starting template.

Four of them (`landing-hero`, `landing-category-grid`, `landing-product-grid`, `landing-range-table`) are flagged `acceptsData: true` in the registry — they automatically receive the homepage's live server-fetched products/categories as a `data` prop; you never pass products in their config.

| Key | Wraps | Config-driven? | Live data? |
|---|---|---|---|
| `landing-promo-banner` | Top gradient bar: "same-day despatch" + trade-account promo | No — fixed copy | No |
| `landing-hero` | Full hero: headline, best-sellers card | Only `showBestSellersCard` (via `homepage.showBestSellersCard`) | ✅ real products |
| `landing-trust-strip` | 5-item delivery/trade trust strip | No — fixed copy | No |
| `landing-category-grid` | 4-category grid with emoji/gradient fallback art | No — fixed styling | ✅ real categories |
| `landing-product-grid` | A titled product grid (used twice: "Featured" + "More from our range") | `title`, `titleHighlight`, `viewAllHref/Label`, `sliceStart/End`, `whiteBackground` | ✅ real products (sliced) |
| `landing-split-cards` | Two cards: "Open a trade account" (navy) + "Bespoke & bulk orders" (red) | No — fixed copy | No |
| `landing-stats-band` | Fixed 4-stat band (30+ years, 79+ products, etc.) | No | No |
| `landing-how-to-order` | Fixed 4-step "Browse → Login → Checkout → Delivery" | No | No |
| `landing-range-table` | Auto-built table of every real product, In-stock/Out-of-stock pills | No — styling fixed | ✅ real products + categories |
| `landing-testimonials` | 3 fixed reviews + a Trustpilot summary bar (4.7, 94 reviews) | No — fixed reviews | No |
| `landing-newsletter` | Newsletter sign-up, self-hides via the `newsletter` plugin | No — fixed copy | No (posts to `/api/newsletter/subscribe`) |

**Example — the two real config entries currently used on Tri Star's live homepage:**
```json
{ "__block": "landing-hero" },
{
  "__block": "landing-product-grid",
  "title": "Featured",
  "titleHighlight": "products",
  "viewAllHref": "/products",
  "viewAllLabel": "View all products →",
  "sliceStart": 0,
  "sliceEnd": 4,
  "whiteBackground": true
}
```

`landing-newsletter` additionally needs `"requiredPlugin": "newsletter"` in its config entry to respect the plugin gate (its underlying `Newsletter` component also self-checks the plugin client-side as a second guard).

---

# Known overlaps ("twins") — pick deliberately

A few library blocks cover similar ground to a Tri Star original but are **not interchangeable** — different props, different data source, different visual polish level. Don't assume you can swap one key for the other:

| Topic | Config-authored (library) | Tri Star original (live/fixed) |
|---|---|---|
| Trust badges | `trust-strip` | `landing-trust-strip` |
| Category showcase | `category-grid` | `landing-category-grid` (live categories) |
| Big stats band | `stats-band` | `landing-stats-band` (fixed Tri Star numbers) |
| How-to-order steps | `how-to-order` (4 or 5 steps) | `landing-how-to-order` (fixed 4 steps) |
| Product spec table | `product-range-table` | `landing-range-table` (auto-built from live catalogue) |
| Reviews | `testimonials-carousel` (one-at-a-time, auto-advancing) | `landing-testimonials` (static 3-card grid + Trustpilot bar) |
| Newsletter | `newsletter-section` (generic, not plugin-gated itself) | `landing-newsletter` (Tri Star copy, plugin-gated) |

Reconciling these twins into one canonical implementation each is tracked for the Phase 3 component-library session (backlog item Q) — not done yet, so both currently coexist deliberately.

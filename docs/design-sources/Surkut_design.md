# Surkut Miniatures — Design Source

**Client:** Surkut Miniatures (surkut.co.uk) — commission miniature painting, streamed live on Twitch.
**Source:** https://github.com/asthika-asthi/Surkut — finished single-page site (`html/index.html`), built externally. This is the agreed design; intake follows the spec's page-intake procedure.
**Captured:** 2026-07-18

## Palette (CSS variables from the source page)

| Role | Value |
|---|---|
| Gold (primary/CTA) | `#C9A84C` |
| Gold light (hover/emphasis) | `#E8C97A` |
| Gold dark | `#9A7A2E` |
| Page background | `#10131A` |
| Deep background (hero/footer bands) | `#0A0C10` |
| Card background | `#161B26` |
| Body text (cream) | `#F0EAD6` |
| Dim text | `#B8AE98` |
| Muted text | `#8A8070` |
| Borders | gold at 20% / 50% alpha |
| Live/status green | `#22C55E` (status colour — stays hardcoded per token rules) |

## Typography
- Headings: **Cinzel** (serif, 400/600/700)
- Body: **Raleway** (sans, 400/500/600/700)

## Section list (top to bottom) and block mapping

| # | Source section | Block | New? |
|---|---|---|---|
| 1 | Hero: "Commissions Open" badge, "Your Army, Painted Live. With Your Input.", dual CTA, 3 stat chips | `spotlight-hero` | NEW |
| 2 | Services: 3 commission tiers (Tabletop £10 / Premium £20 / Display POA), features, "Most Popular" flag | `pricing-tiers` | NEW |
| 3 | Process: 5 numbered steps | `how-to-order` | reuse |
| 4 | Portfolio: image cards with tier badges + "slots available" card | `showcase-gallery` | NEW |
| 5 | Videos: 2 stream clips with captions | `video-showcase` | NEW |
| 6 | Stream: Twitch spotlight panel + bullets + channel link | `stream-spotlight` | NEW |
| 7 | Audience: 4 persona cards (Wargamers / DMs / Busy professionals / Collectors) | `bento-grid` | reuse |
| 8 | FAQ: 6 Q&A accordion | `faq-accordion` | NEW |
| 9 | Commission: enquiry form + socials sidebar | `enquiry-form` (posts to `/api/contact`) | NEW |

## Naturalisation decisions
- All colours → theme tokens (no raw hex in blocks); the gold/dark values live only in the client branch's `themes/default/globals.css`.
- Cinzel applied via the shared `font-heading` utility (falls back to the client's sans for every other client).
- Persona-card "pain point" chips simplified into the card body text (bento-grid reuse).
- Twitch panel is a styled preview card linking out — no iframe embed (avoids Twitch's `parent` domain restriction in dev).
- Social links (Instagram/Patreon URLs) and `contact_email` are best-guess — **confirm with the client before go-live.**

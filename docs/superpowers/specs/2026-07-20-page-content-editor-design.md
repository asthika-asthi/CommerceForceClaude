# Page Content Editor — Design Spec

**Date:** 2026-07-20
**Status:** Approved, ready for implementation planning
**Resolves:** Backlog item W (remaining half — the admin "Page Content" editor / DB content-layer decision)

---

## 1. The problem

The admin panel has a "Landing Page Sections" screen ("Drag-and-drop builder for
your storefront homepage") that looks fully functional — it lets a shop-admin
add, edit, reorder, and delete sections, and it saves successfully. But the
storefront homepage has never read from the database table it writes to
(`landing_sections`). It reads `landing-page.config.json` instead, a
git-tracked file only the superadmin (agency) edits. The admin screen is
dead: it works, but nothing it does is ever seen by a visitor.

This was surfaced during 2026-07-20 manual testing of the Phase 3 component
library work and confirmed against the current code — not a new discovery,
just a live re-confirmation of what backlog item W already flagged.

**Engineering half of item W is already done** (2026-07-16, "Per-client UI
pipeline — Phase 1 wiring"): the homepage renders from the config file
through the block registry. This spec covers the remaining half: replacing
the dead admin screen with something that actually works, and deciding how
shop-admin content edits reach the live site.

## 2. Roles, restated

This project's existing role split (unchanged, just made explicit here
because it drives every decision below):

- **Superadmin (the agency)** — builds and owns page *structure*: which
  blocks exist, in what order, with what starting content. Already has full,
  unrestricted control today by hand-editing `landing-page.config.json` and
  redeploying. Nothing in this spec changes or routes through that channel.
- **Shop-admin (the client's own staff)** — manages day-to-day business
  content. Today they can edit branding (store name, colours, logo, contact
  info) live, no redeploy needed. They currently have **no working way** to
  edit homepage section content — that's the gap this spec closes.

This spec is about giving the shop-admin a real, working, appropriately
limited version of the editing power the current dead screen only pretended
to offer. It never changes what the superadmin can do.

## 3. Non-goals

- No ability for the shop-admin to add, delete, or reorder sections. Ever.
  Structure stays 100% superadmin, enforced by the design (the new screen
  has no controls for this at all, not just hidden ones).
- No new schema-authoring step per block type (this was seriously considered
  and rejected — see §9, "Rejected approaches").
- No change to how the superadmin builds a page. Same file, same workflow,
  same deploy.
- Time-sensitive promotional content (the "Limited Time" style banner) is
  explicitly out of scope for this system — see §7.

## 4. Architecture

### 4.1 Storage: overrides layered on top of the config file

Shop-admin content edits are stored in a new database table, entirely
separate from `landing-page.config.json`. The config file is never written
to by this system — it stays exactly what it is today, a superadmin-only,
git-tracked file.

At render time, the homepage reads the config file as it always has, then
merges any saved database overrides on top, field by field. A database
override wins if present; otherwise the config file's own value applies.
This is the same pattern already proven in this codebase for brand colours
(`branding_config.theme_colors`: file defaults + DB overrides, empty = file
defaults apply unchanged).

**Consequence:** an empty overrides table is indistinguishable from "nothing
has been customised yet" — the live site renders exactly as the config file
describes. This is what makes "the live site is unchanged on day one"
automatic rather than something to test for: on day one, the table is empty,
full stop.

**Consequence:** no shop-admin content edit ever requires a deploy or a
server restart. It's a live database read, same as branding today.

### 4.2 Determining what's editable: no separate schema file

Two nested levels of opt-in, both authored directly in
`landing-page.config.json` — no new file anywhere describing block shapes.

1. **Section level:** a section is shop-admin-editable only if the
   superadmin explicitly flags it so. Default is **off** — most sections
   stay fully fixed. This matches the existing `requiredPlugin` flag already
   used in this same file (opt-in, not opt-out), and matches the safety
   priority behind this whole design: nothing is ever exposed by accident.
2. **Field level:** for each editable section, the superadmin lists exactly
   which named fields within it are editable (e.g., for the hero: `title`
   and `subtitle`, but not `scrollToExpand` or the background image). This
   list lives next to the section's own content in the same file — nothing
   new to keep in sync with the block's actual code.

**Identifying a section for override storage:** a database override has to
point at a specific section, but sections in the config file are just array
entries with no stable identity today — array position isn't safe to use as
a key, since reordering or inserting an unrelated section elsewhere in the
file would silently reassign positions and misattribute saved content to
the wrong section. Every section the superadmin flags editable therefore
also gets a short, superadmin-chosen label at the same time (e.g. `hero`,
`trust-strip`) — set once, alongside the flag, never touched by the
shop-admin. This is the same kind of addition as the flag and field list
themselves: authored in the config file, nothing new to keep in sync.

**How the edit form knows what kind of input to show:** by looking at each
named field's real, current value — a plain string becomes a text box; a
field whose name matches the image-naming convention already used
throughout the block library (`image`, `logo`, `bgImageSrc`, etc.) becomes a
Media Library picker; a field paired with a URL becomes a link field. This
is inferred live from real data every time, not declared anywhere. A
brand-new block type therefore needs zero additional authoring to become
editable the first time a superadmin decides to expose one of its fields —
they just name the field, the same as any other block.

This was a deliberate, considered rejection of a hand-maintained
per-block-type schema (see §9) specifically because this project already has
two known, bug-causing instances of exactly that pattern (`theme-colors.ts`
and `block-defaults.ts`, both hand-duplicated between the storefront and
admin apps — the documented cause of backlog item T). This design adds zero
new instances of that pattern.

### 4.3 The backend as the single source of truth

The admin panel is a separate application from the storefront and cannot
read `landing-page.config.json` directly. The backend becomes the one place
that:

- Reads the config file directly (not a copy of it) to determine which
  sections are flagged editable and which fields are named.
- Serves that, plus each field's current effective value (override if one
  exists, otherwise the config's own value), to the admin panel's edit
  screen.
- Validates every incoming save against that same file's field list before
  writing anything to the database — a field not named in the config is
  rejected, not silently dropped.

This requires the backend to have read access to a file that today only the
storefront (`frontend-starter`) touches. Both apps already run from the same
per-client deployment (same VPS, same `docker-compose.yml` stack), so this
is a same-host file-access question, not a new network dependency — the
implementation plan should specify the exact mechanism (shared volume vs.
a fixed relative path both containers can reach).

This preserves the actual goal that motivated putting a schema in the
backend in the first place (a single, backend-enforced source of truth) —
it just achieves it by reading the real, already-authored file, instead of
maintaining a separate description of it.

## 5. New/changed components

**Backend (new):**
- A new table storing shop-admin content overrides — one row per edited
  section, holding only the fields actually overridden. Retire the old
  `landing_sections` table and its endpoints entirely (delete, not just stop
  using — matches this project's existing no-dead-code discipline).
- A read endpoint: given the current client's config, return the editable
  sections, their named fields, and each field's current effective value.
- A save endpoint: validates field names against the config's allow-list per
  section, then writes overrides. A hide/show flag per section is part of
  this same save path.

**Admin panel (`frontend-admin`):**
- Replace the "Landing Page Sections" screen with a new "Page Content"
  screen. Lists only sections flagged editable, in page order. Each section
  is a small form: text boxes for text fields, a Media Library picker for
  image fields, a link field for URL fields, and a show/hide toggle. No add,
  delete, or reorder controls anywhere on this screen.

**Storefront (`frontend-starter`):**
- The existing render path (`getFilteredSections` → `LandingSectionRenderer`)
  gains one step: after reading a section's props from the config, merge in
  any saved overrides for that section before rendering. If there are none,
  behaviour is unchanged from today.

**Config file (`landing-page.config.json`):**
- Each section entry that should be shop-admin-editable gains the two
  additions from §4.2 (an editable flag, a field-name list). No other
  section is touched.

## 6. Images

Editable image fields are filled via the existing Media Library (the
already-built upload + folder-browser used elsewhere in admin), not a raw
URL text box. This keeps image handling consistent with how it already works
for products, and gives the shop-admin genuine self-service (upload, don't
just link to something hosted elsewhere).

## 7. The promo-banner / announcements overlap

`landing-promo-banner` (the "Limited Time... Order before 2pm" strip)
currently exists as a fixed, hardcoded-copy section — not part of this
system's scope at all. Its content moves to the existing `announcements`
plugin, which shop-admins can already manage today and which additionally
supports start/end dates and an active toggle that the current fixed banner
doesn't have. This section is simply never flagged editable under this
design; the redirect to announcements is a separate, small piece of
follow-up work, not part of this spec's build.

## 8. Error handling

- **A superadmin's field list names a field that doesn't exist on that
  block** (typo, or the block's props changed since the list was written):
  the admin screen simply omits that field from the form. This fails
  quietly on the authoring side; the shop-admin never sees a broken field
  either way, since it just doesn't appear.
- **A save names a field not on the section's allow-list:** rejected by the
  backend at the save endpoint, not silently dropped and not passed through.
- **The config file is malformed or unreadable:** the existing behaviour
  (the whole homepage fails to render) is unchanged — this system doesn't
  introduce a new failure mode here, since it depends on the same file the
  homepage already depends on.

## 9. Rejected approaches (for the record)

**A hand-maintained content schema per block type**, living either in
the admin app, or split between the admin app and the backend, or
consolidated into a single backend copy — all seriously considered across
several rounds of this discussion. Rejected because every version of it
requires someone to explicitly write down, for every block a client wants
editable, a separate description of that block's fields — a description
that has to be kept in sync with the block's actual code by memory. This
project already has two proven instances of exactly this failure mode
(`theme-colors.ts`, `block-defaults.ts`), both documented causes of real
bugs (backlog item T). The chosen design (§4.2) achieves the same field-level
precision this approach was valued for, without adding a third instance of
that pattern.

**Admin edits writing directly to the config file** (no database layer).
Rejected because it reopens the "how do config changes reach the VPS"
deployment question that the overrides-layer approach avoids entirely, and
blurs the superadmin/shop-admin boundary this whole design is built to keep
firm.

## 10. Verification approach

1. **Day-one proof:** ship with zero sections flagged editable. Confirm the
   live Tri Star homepage is pixel-identical to before — this should require
   no special effort, since an empty overrides table is by construction
   indistinguishable from "no system present at all."
2. Flag one section editable with a small field list. Confirm it appears
   correctly in the new Page Content screen and nowhere else changes.
3. Edit and save a field. Confirm it renders live on the homepage
   immediately, no restart needed.
4. Hide the section via the toggle. Confirm it disappears from the homepage
   without needing to be un-flagged or deleted from the config.
5. Un-flag the section (superadmin removes the editable flag from the
   config). Confirm the homepage falls back to the config's own value,
   regardless of what override was previously saved.
6. Attempt to save a field name not on a section's allow-list directly
   against the API (bypassing the admin UI). Confirm it's rejected.
7. Confirm the old `landing_sections` table and its endpoints are fully
   removed, not just unused.

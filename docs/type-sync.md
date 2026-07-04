# Keeping Frontend Types in Sync with the Backend

**Read this whenever you change the shape of an API request or response.**

## The contract (source of truth)

The backend **Pydantic schemas** are the single source of truth for the API — every
field name and type in every request and response. FastAPI publishes them as a standard,
machine-readable **OpenAPI spec** at:

```
http://localhost:8000/api/openapi.json
```

That spec *is* the interface between the backend and the frontends. There is **no shared
type file**, because the backend (Python) and the frontends (TypeScript) are separate
codebases in different languages — a type cannot be literally shared across that boundary.
Each side keeps its own copy of the contract.

## The four representations (and which the app actually uses)

| File | Language | Kept in sync by | Used by the running app? |
|------|----------|-----------------|--------------------------|
| `backend/app/plugins/*/schemas.py` (Pydantic) | Python | by hand | ✅ defines the real API |
| `frontend-starter/lib/types.ts` | TypeScript | **by hand** | ✅ storefront |
| `frontend-admin/lib/types.ts` | TypeScript | **by hand** | ✅ admin |
| `frontend-starter/lib/generated-types.ts` | TypeScript | auto (from OpenAPI) | ❌ only diffed, never imported |

The two `lib/types.ts` files are **hand-written mirrors** of the backend contract. They can
silently fall out of step with the backend — this is called **drift**.

> ⚠️ The **admin app has no generator** — its `lib/types.ts` must be reconciled by hand
> against the schema. Only the storefront has the `gen:types` helper below.

## Why drift is dangerous — real bugs it caused

Every one of these was a hand-written frontend type disagreeing with the backend:

- The product **list** endpoint returns `primary_image`, but the frontend type said
  `images[]` → homepage and thumbnails showed placeholder emoji instead of real photos.
- The list type was **missing `description`** → the homepage "quick reference" table
  showed `—`.
- The type was **missing `is_featured`** → the admin "Featured" toggle couldn't be wired
  until the field was added.

The type checker (`tsc`) cannot catch these, because the hand-written type *is* what it
checks against — if the type is wrong, the check passes but the app is wrong at runtime.

## Mandatory checklist — run on every backend schema change

When you **add, rename, remove, or retype** a field on any Pydantic request/response
schema (`*Out`, `*Create`, `*Update`, etc.):

1. **Storefront** (has the generator):
   - Make sure the backend is running on `:8000`.
   - From `frontend-starter/`: `npm run gen:types`
     (runs `npx openapi-typescript http://localhost:8000/api/openapi.json -o lib/generated-types.ts`).
   - Diff the regenerated `lib/generated-types.ts` against `lib/types.ts` and update
     `lib/types.ts` to match the changed field(s).
2. **Admin** (no generator):
   - Reconcile `frontend-admin/lib/types.ts` by hand against the changed schema (or run
     the same `openapi-typescript` command ad-hoc to compare).
3. **Type-check** each affected frontend: `npx tsc --noEmit`.
4. If a field is only on the **detail** endpoint vs the **list** endpoint, remember they
   are different shapes (`ProductOut` has `images[]`; `ProductListOut` has `primary_image`)
   — update the specific type the affected page uses.

## Future improvement (tracked)

This hand-sync is the "bad kind" of duplication (the same contract copied by hand in
multiple places). See the backlog item **T — Eliminate frontend/backend type
duplication** for the planned fix: an automated drift-check and/or true codegen so the
frontend types are *derived* from the backend instead of hand-maintained, plus adding a
`gen:types` script to the admin app.

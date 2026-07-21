import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { BuilderClient } from "./builder-client"

export const metadata: Metadata = {
  robots: { index: false, follow: false },
}

// Never statically cached — the whole point of this tool is that it reads
// the config file and every block's fields fresh, every time, with nothing
// that can go stale. A cached/prerendered version of this page would show
// exactly the staleness this tool exists to avoid.
export const dynamic = "force-dynamic"

// Dev/QA-only route: lets a superadmin assemble a client's homepage sections
// by picking blocks and filling in a form, instead of hand-editing
// landing-page.config.json. Same production gate as /dev/block-preview —
// this route ships in every client's build, so it must not be reachable
// once NODE_ENV is production.
export default async function PageBuilderPage() {
  if (process.env.NODE_ENV === "production") {
    notFound()
  }

  // Dynamic import so the ts-morph-based extractor (and ts-morph itself) is
  // never pulled into this route's bundle during a production build at all —
  // only loaded on an actual dev-mode request, past the guard above.
  const { loadBuilderData } = await import("./actions")
  const { schemas, sections, plugins } = await loadBuilderData()

  return <BuilderClient schemas={schemas} initialSections={sections} initialPlugins={plugins} />
}

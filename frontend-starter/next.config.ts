import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  // Dev server default disposes a compiled page after a short idle period to
  // save memory; coming back to it then forces a recompile before it can
  // serve anything, and a slow recompile (e.g. /dev/page-builder, which pulls
  // in a TypeScript-AST-parsing dependency) can time out the browser's chunk
  // request with a ChunkLoadError. Give pages much longer before eviction,
  // and keep more of them compiled at once, since this is a local dev tool
  // meant to be left open and returned to, not a high-traffic production app.
  onDemandEntries: {
    maxInactiveAge: 25 * 60 * 1000,
    pagesBufferLength: 5,
  },
};

export default nextConfig;

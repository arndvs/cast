/**
 * Write stage — `write`.
 *
 * Thin wrapper around `storage.writeCreative`. Kept as its own pipeline
 * module so the orchestrator's stage enum and per-stage retry surface stay
 * symmetric (every stage = one module).
 */

import type { AspectRatio } from "@/lib/cast/schemas"
import { writeCreative as writeToDisk, writeMetadata as writeMetaToDisk } from "@/lib/cast/server/storage"
import type { ImageMetadata } from "@/lib/cast/server/metadata"

export async function writeCreativeOutput(args: {
  campaign: string
  market: string
  productSlug: string
  ratio: AspectRatio
  png: Buffer
  metadata?: ImageMetadata
}): Promise<string> {
  const outputPath = await writeToDisk(args.campaign, args.market, args.productSlug, args.ratio, args.png)

  if (args.metadata) {
    try {
      await writeMetaToDisk(args.campaign, args.market, args.productSlug, args.ratio, args.metadata)
    } catch {
      // Best-effort — metadata sidecar failure must not block the pipeline.
      // The PNG was already written successfully above.
    }
  }

  return outputPath
}

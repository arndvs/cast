/**
 * Write stage — `write`.
 *
 * Thin wrapper around `storage.writeCreative`. Kept as its own pipeline
 * module so the orchestrator's stage enum and per-stage retry surface stay
 * symmetric (every stage = one module).
 */

import type { AspectRatio } from "@/lib/cast/schemas"
import { writeCreative as writeToDisk } from "@/lib/cast/server/storage"

export async function writeCreativeOutput(args: {
  campaign: string
  market: string
  productSlug: string
  ratio: AspectRatio
  png: Buffer
}): Promise<string> {
  return writeToDisk(args.campaign, args.market, args.productSlug, args.ratio, args.png)
}

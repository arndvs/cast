/**
 * Server-only brief loader — V2.
 *
 * Reads `inputs/brief.json` from the repo root and validates with
 * `briefSchema`. This is the seed for the S1 reducer's initial state.
 *
 * V3 will not change this contract — V3 adds new routes (`/api/brands` etc.)
 * but the bootstrap brief still loads from disk on the initial render.
 */

import { readFile } from "node:fs/promises"
import path from "node:path"

import { briefSchema, type Brief } from "@/lib/cast/schemas"

export async function loadDemoBrief(): Promise<Brief> {
  const file = path.join(process.cwd(), "inputs", "brief.json")
  const raw = await readFile(file, "utf8")
  const json = JSON.parse(raw) as unknown
  return briefSchema.parse(json)
}
